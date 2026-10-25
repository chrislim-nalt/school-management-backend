// utils/studentImport.js
// Pure helper functions for the bulk student import (no database access here,
// so the logic is easy to test and cannot affect live data by itself).

const MAX_IMPORT_ROWS = 500; // keeps the JSON body well under Express's default 100kb limit
const MAX_NAME_LENGTH = 100;

// Tidy a name for saving: collapse repeated spaces, trim the ends.
// Casing is kept exactly as written in the file.
const cleanName = (value) =>
  (value === null || value === undefined ? "" : String(value))
    .replace(/\s+/g, " ")
    .trim();

// Keys used to compare names. Both ignore case, accents and extra spaces.
//  - exactKey keeps the word order:      "Kevine Uwase" == "kevine  uwase"
//  - looseKey ignores the word order AND includes gender, because names in
//    Rwanda are often written in a different order ("UWASE KEVINE" vs
//    "KEVINE UWASE"), but two different children can also share the same words
//    (a boy and a girl) — so a reordered match only counts when gender agrees.
const baseKey = (value) =>
  cleanName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const exactKey = (value) => baseKey(value);

const looseKey = (value, gender) =>
  baseKey(value).split(" ").filter(Boolean).sort().join(" ") + "|" + (gender || "");

const normalizeText = (value) =>
  (value === null || value === undefined ? "" : String(value)).trim().toLowerCase();

const MALE_VALUES = new Set(["m", "male", "boy", "man", "masculin", "garcon", "gabo"]);
const FEMALE_VALUES = new Set(["f", "female", "girl", "woman", "feminin", "fille", "gore"]);

// Returns "MALE", "FEMALE" or null when the value is not recognised.
const parseGender = (value) => {
  const key = normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
  if (MALE_VALUES.has(key)) return "MALE";
  if (FEMALE_VALUES.has(key)) return "FEMALE";
  return null;
};

/**
 * Decide what will happen to every uploaded row.
 *
 * @param {Array<{name:any, gender:any}>} rows       rows sent by the browser
 * @param {Array<{name:string, grade:string, className:string}>} existing
 *        all non-deleted students of the school (only name/grade/className needed)
 * @param {string} grade       target grade
 * @param {string} className   target class
 * @returns {{items: Array, toAdd: Array}}
 */
const analyzeRows = (rows, existing, grade, className) => {
  const targetGrade = normalizeText(grade);
  const targetClass = normalizeText(className);

  const sameClassExact = new Map(); // exactKey -> existing name
  const sameClassLoose = new Map(); // looseKey -> existing name
  const otherExact = new Map(); // exactKey -> "P2 B"
  const otherLoose = new Map(); // looseKey -> "P2 B"
  for (const s of existing) {
    const g = parseGender(s.gender);
    const ek = exactKey(s.name);
    if (!ek) continue;
    const lk = looseKey(s.name, g);
    if (normalizeText(s.grade) === targetGrade && normalizeText(s.className) === targetClass) {
      if (!sameClassExact.has(ek)) sameClassExact.set(ek, s.name);
      if (!sameClassLoose.has(lk)) sameClassLoose.set(lk, s.name);
    } else {
      const where = `${s.grade} ${s.className}`.trim();
      if (!otherExact.has(ek)) otherExact.set(ek, where);
      if (!otherLoose.has(lk)) otherLoose.set(lk, where);
    }
  }

  const seenExact = new Set();
  const seenLoose = new Set();
  const items = [];
  const toAdd = [];

  rows.forEach((row, index) => {
    const rowNumber = Number.isInteger(row && row.row) ? row.row : index + 1;
    const name = cleanName(row && row.name);
    const rawGender = row && row.gender;
    const item = { row: rowNumber, name, gender: null, status: "new", reason: "", note: "" };

    if (!name) {
      item.status = "invalid";
      item.reason = "Name is empty";
      items.push(item);
      return;
    }
    if (name.length > MAX_NAME_LENGTH) {
      item.status = "invalid";
      item.reason = `Name is longer than ${MAX_NAME_LENGTH} characters`;
      items.push(item);
      return;
    }

    const gender = parseGender(rawGender);
    if (!gender) {
      item.status = "invalid";
      item.reason =
        rawGender === undefined || rawGender === null || String(rawGender).trim() === ""
          ? "Gender is empty (use M or F)"
          : `Gender "${String(rawGender).trim()}" not recognised (use M or F)`;
      items.push(item);
      return;
    }
    item.gender = gender;

    const ek = exactKey(name);
    const lk = looseKey(name, gender);

    // 1) already in the selected class?
    if (sameClassExact.has(ek) || sameClassLoose.has(lk)) {
      item.status = "duplicate";
      item.reason = "Already in this class";
      item.matchedName = sameClassExact.get(ek) || sameClassLoose.get(lk);
      items.push(item);
      return;
    }

    // 2) listed twice in the same file?
    if (seenExact.has(ek) || seenLoose.has(lk)) {
      item.status = "duplicate_in_file";
      item.reason = "Appears more than once in the file";
      items.push(item);
      return;
    }
    seenExact.add(ek);
    seenLoose.add(lk);

    // 3) fine to add — just warn if the same name lives in another class
    const elsewhere = otherExact.get(ek) || otherLoose.get(lk);
    if (elsewhere) item.note = `Also registered in ${elsewhere}`;

    items.push(item);
    toAdd.push({ name, gender });
  });

  return { items, toAdd };
};

const summarize = (items) => {
  const count = (status) => items.filter((i) => i.status === status).length;
  return {
    total: items.length,
    toAdd: count("new"),
    duplicates: count("duplicate"),
    duplicatesInFile: count("duplicate_in_file"),
    invalid: count("invalid"),
  };
};

module.exports = {
  MAX_IMPORT_ROWS,
  MAX_NAME_LENGTH,
  cleanName,
  exactKey,
  looseKey,
  parseGender,
  analyzeRows,
  summarize,
};
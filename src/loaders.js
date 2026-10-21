const fs = require("node:fs");
const path = require("node:path");

// Lädt alle .js-Dateien eines Ordners als Map (Dateiname -> Export).
// Commands brauchen "data" + "execute" (Default), Events "name" + "execute" (isEvent).
function loadFolder(dir, { isEvent = false } = {}) {
  const entries = new Map();
  const fullPath = path.join(__dirname, "..", dir);
  if (!fs.existsSync(fullPath)) return entries;

  for (const file of fs.readdirSync(fullPath).filter((file) => file.endsWith(".js"))) {
    const entry = require(path.join(fullPath, file));
    const valid = isEvent ? "name" in entry && "execute" in entry : "data" in entry && "execute" in entry;
    if (valid) entries.set(path.basename(file, ".js"), entry);
    else console.warn(`[WARNING] ${dir}/${file} fehlt eine required Eigenschaft – wird ignoriert.`);
  }
  return entries;
}

module.exports = { loadFolder };

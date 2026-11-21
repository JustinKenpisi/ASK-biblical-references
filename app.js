"use strict";

const byId = id => document.getElementById(id);
const query = byId("query");
const sort = byId("sort");
const results = byId("results");
const status = byId("status");
const previous = byId("previous");
const next = byId("next");
const pageSize = 25;
const collator = new Intl.Collator("en-GB", { sensitivity: "base" });
let entries = [];
let pageNotes = [];
let matches = [];
let resultPage = 0;

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function normalise(value) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[‐‑‒–—]/g, "-")
    .replace(/[*_]/g, "").replace(/\s*:\s*(?=\d)/g, ":")
    .replace(/\s+/g, " ").trim();
}

const books = "Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|[12] Samuel|[12] Kings|[12] Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|(?:[123] )?John|Acts|Romans|[12] Corinthians|Galatians|Ephesians|Philippians|Colossians|[12] Thessalonians|[12] Timothy|Titus|Philemon|Hebrews|James|[12] Peter|Jude|Revelation";
const bibleQuery = new RegExp(`\\b(${books}) (\\d+)(?::(\\d+)(?:-(\\d+))?)?`, "gi");

function canonicalBook(book) {
  return book === "psalms" ? "psalm" : book;
}

function referenceKeys(fields) {
  const keys = new Set();
  for (const field of fields) {
    if (!/^(?:Primary|Related) reference\(s\)$|^Citation as it appears$/.test(field.label)) continue;
    const value = normalise(field.value);
    for (const match of value.matchAll(bibleQuery)) {
      const book = canonicalBook(match[1]);
      let chapter = Number(match[2]);
      let hasVerse = Boolean(match[3]);
      const add = (first, last) => {
        const prefix = `${book} ${chapter}`;
        keys.add(prefix);
        if (!first) return;
        for (let verse = Number(first); verse <= Math.min(Number(last || first), Number(first) + 200); verse++) {
          keys.add(`${prefix}:${verse}`);
        }
      };
      add(match[3], match[4]);
      let tail = value.slice(match.index + match[0].length);
      let continuation;
      while ((continuation = /^\s*[,;]\s*(\d+)(?::(\d+))?(?:-(\d+))?\b(?!\s+[a-z])/i.exec(tail))) {
        const [, first, verse, last] = continuation;
        if (verse) {
          chapter = Number(first);
          hasVerse = true;
          add(verse, last);
        } else if (hasVerse) {
          add(first, last);
        } else {
          chapter = Number(first);
          add();
        }
        tail = tail.slice(continuation[0].length);
      }
    }
  }
  return keys;
}

function fieldValue(entry, label) {
  return entry.fields.find(field => field.label === label)?.value.trim() || "";
}

function indexEntry(entry) {
  const recordedPage = fieldValue(entry, "Page number");
  const pages = new Set([entry.page, ...(recordedPage.match(/\d+/g) || []).map(Number)]);
  const text = normalise(entry.fields.map(field => `${field.label} ${field.value}`).join(" ") + " " + entry.authorSort);
  return { ...entry, text, pages, refs: referenceKeys(entry.fields) };
}

// The offline conversion emits formatting tags only. Rebuild those tags
// without copying attributes so catalogue text is never executable.
const formatting = new Set(["em", "strong", "p", "ul", "ol", "li", "hr", "br", "blockquote", "code", "pre"]);
function appendFormatting(target, html) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  function copy(parent, nodes) {
    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        parent.append(document.createTextNode(node.textContent));
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.localName === "h1" ? "h3" : node.localName;
        if (formatting.has(tag) || tag === "h3") {
          const child = element(tag);
          copy(child, node.childNodes);
          parent.append(child);
        } else {
          copy(parent, node.childNodes);
        }
      }
    }
  }
  copy(target, parsed.body.childNodes);
}

function makeResult(item) {
  const details = element("details", undefined, "entry");
  const summary = element("summary");
  const entryNumber = item.number === null ? "Unnumbered entry" : `Entry ${item.number}`;
  const location = item.fields ? `ASK p. ${item.page} · ${entryNumber}` : `ASK p. ${item.page}`;
  summary.append(element("span", location, "entry-location"));
  if (!item.fields) {
    summary.append(element("span", "Standalone page note", "entry-title"));
    const note = element("div", undefined, "editorial");
    appendFormatting(note, item.html);
    details.append(summary, note);
    return details;
  }

  const title = element("span", undefined, "entry-title");
  const wording = item.fields.find(field => field.label === "Wording")?.html;
  if (wording) {
    const parsed = new DOMParser().parseFromString(wording, "text/html");
    const lead = parsed.body.textContent.trim();
    if (lead.length > 180) {
      title.textContent = lead.slice(0, 177).trimEnd() + "…";
    } else {
      for (const paragraph of parsed.body.children) {
        if (title.hasChildNodes()) title.append(" ");
        appendFormatting(title, paragraph.innerHTML);
      }
    }
  }
  if (!title.textContent.trim()) title.textContent = "View entry";
  summary.append(title);
  const author = fieldValue(item, "Author");
  if (author) summary.append(element("span", author, "entry-author"));
  const fields = element("dl", undefined, "fields");
  details.append(summary, fields);
  details.addEventListener("toggle", () => {
    if (!details.open || fields.hasChildNodes()) return;
    for (const field of item.fields) {
      const row = element("div", undefined, "field");
      const value = element("dd");
      appendFormatting(value, field.html);
      row.append(element("dt", field.label), value);
      fields.append(row);
    }
  });
  return details;
}

function search() {
  const raw = normalise(query.value);
  const phrases = [...raw.matchAll(/"([^"]+)"/g)].map(match => match[1]);
  const terms = raw.replace(/"[^"]+"/g, " ").trim();
  const pagePattern = /\b(?:ask\s+)?(?:pages?|pp?\.?)\s*(\d+)\b/g;
  const pageTerms = [...terms.matchAll(pagePattern)].map(match => Number(match[1]));
  let words = terms.replace(pagePattern, " ").trim();
  if (/^\[?\d+\]?$/.test(words)) {
    pageTerms.push(Number(words.replace(/[\[\]]/g, "")));
    words = "";
  }
  const references = [...words.matchAll(bibleQuery)].map(match => ({
    literal: match[0],
    key: match[0].replace(match[1], canonicalBook(match[1]))
  }));
  const tokens = words.replace(bibleQuery, " ").split(/\s+/).filter(token => /[\p{L}\d]/u.test(token));
  matches = [...entries, ...(raw ? pageNotes : [])].filter(item =>
    pageTerms.every(page => item.pages.has(page)) &&
    phrases.every(phrase => item.text.includes(phrase)) &&
    tokens.every(token => item.text.includes(token)) &&
    references.every(({ literal, key }) => item.refs?.has(key) ||
      new RegExp(`\\b${literal}\\b`, "i").test(item.text))
  );

  if (sort.value !== "source") {
    const direction = sort.value === "ascending" ? 1 : -1;
    matches.sort((left, right) => {
      const a = left.authorSort === "—" ? "" : left.authorSort;
      const b = right.authorSort === "—" ? "" : right.authorSort;
      if (!a || !b) return Number(Boolean(b)) - Number(Boolean(a));
      return direction * collator.compare(a, b);
    });
  } else {
    matches.sort((a, b) => a.page - b.page);
  }
  resultPage = 0;
  display();
}

function display() {
  const first = resultPage * pageSize;
  const last = Math.min(first + pageSize, matches.length);
  results.replaceChildren(...matches.slice(first, last).map(makeResult));
  status.textContent = matches.length
    ? `Showing ${(first + 1).toLocaleString("en-GB")}–${last.toLocaleString("en-GB")} of ${matches.length.toLocaleString("en-GB")} results`
    : "No results. Try a shorter phrase, a Bible reference such as John 15:14, or an ASK page such as page 59. Reset clears the search.";
  const totalPages = Math.ceil(matches.length / pageSize);
  byId("pagination").hidden = totalPages <= 1;
  byId("result-page").textContent = `Result page ${resultPage + 1} of ${totalPages}`;
  previous.disabled = resultPage === 0;
  next.disabled = resultPage + 1 >= totalPages;
}

function changePage(step) {
  resultPage += step;
  display();
  results.querySelector("summary")?.focus();
}

function showFigures(data) {
  const authors = new Set(data.entries.map(entry => entry.authorSort).filter(name => name && name !== "Anonymous" && name !== "—"));
  const comments = data.entries.reduce((count, entry) => count + (Number.isInteger(entry.number) ? entry.fields.filter(field => field.note).length : 0), 0);
  const figures = byId("figures");
  for (const [label, count] of [
    ["Entries", data.entries.length], ["Named authors", authors.size], ["Entry notes", comments]
  ]) {
    const group = element("div");
    group.append(element("dt", label), element("dd", count.toLocaleString("en-GB")));
    figures.append(group);
  }
  figures.hidden = false;
}

async function load() {
  try {
    const response = await fetch("./catalogue-v15.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    entries = data.entries.map(indexEntry);
    pageNotes = data.pageNotes.map(note => ({
      ...note, pages: new Set([note.page]), text: normalise(note.markdown)
    }));
    for (const note of pageNotes) {
      byId("page-notes").append(element("h3", `ASK page ${note.page}`));
      appendFormatting(byId("page-notes"), note.html);
    }
    appendFormatting(byId("editorial"), data.introductionHtml);
    showFigures(data);
    for (const control of [query, sort, byId("reset")]) control.disabled = false;
    search();
  } catch (error) {
    status.textContent = "The catalogue could not be loaded. Open the GitHub Pages site or serve these files over HTTP, then reload.";
    console.error(error);
  }
}

query.addEventListener("input", search);
sort.addEventListener("change", search);
byId("controls").addEventListener("submit", event => {
  event.preventDefault();
  search();
});
byId("controls").addEventListener("reset", event => {
  event.preventDefault();
  query.value = "";
  sort.value = "source";
  search();
  query.focus();
});
previous.addEventListener("click", () => changePage(-1));
next.addEventListener("click", () => changePage(1));
load();

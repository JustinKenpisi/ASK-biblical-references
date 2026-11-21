# All Slave-keepers biblical reference catalogue

This static site makes the biblical-reference database for Benjamin Lay’s *All Slave-keepers* (ASK) searchable. It includes biblical citations, quotations, paraphrases and allusions in Lay’s text and in material he reproduced. The page numbers follow the Meggitt and Rediker edition.

## Publish with GitHub Pages

1. Extract the ZIP. Create or open a GitHub repository and select the `main` branch.
2. Upload all five files directly to the repository root using **Add file → Upload files**. Commit them to `main`. The root should contain [index.html](./index.html), [styles.css](./styles.css), [app.js](./app.js), [catalogue-v15.json](./catalogue-v15.json) and this README.
3. Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then select `main` and `/ (root)`. Select **Save**.
4. Once deployment completes, open the published link shown under **Settings → Pages**.

To preview locally, run `python3 -m http.server 8000` from the extracted folder and open the local server on port 8000 in your browser. The catalogue loads its JSON over HTTP, so opening the HTML directly from disk may fail.

## Source and counts

Each source entry has its own JSON record with its original heading, Markdown and ordered labelled fields. Repeated labels, blank values and source classifications are retained. Standalone page notes stay with their page, including the “Blank” marker on page 2.

The site calculates its totals from the JSON. Named author totals and sorting group “Lay” and “Benjamin Lay?” with Benjamin Lay. The display retains the original attributions, including uncertainty. “Anonymous” and the dash placeholder are excluded from the named author total. Every nonempty Comments block other than a dash placeholder counts as an entry note. The source contains no explicit Quaker designation field or classification, so there are zero explicitly classified Quaker entries. Quaker references in the historical wording and notes remain searchable as text.

Built using research by Justin Meggitt and Marcus Rediker.

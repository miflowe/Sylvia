# Plant curation sheets

These four CSV files are Sylvia's curated plant data for the Ontario (`CA-ON`) and BC (`CA-BC`) pilots. Sprout's
verdicts, explanations and native swaps all come from here. Outside the pilots the app falls back to VASCAN
(native / introduced only) and labels the result "lower confidence".

Open them in Excel and save as **CSV UTF-8**. Then run `pnpm data:check` (or send the files to Claude) to
validate them.

## The rules
1. **Every claim needs a source.** Fill the source name, and the URL where you can.
2. **Every row starts as `draft`.** Only change it to `reviewed` after you have checked the row against its
   source. Put your initials in `reviewed_by` and the date (`2026-11-03`) in `reviewed_at`. Draft rows show in the
   app with a "not yet reviewed" note.
3. **Never call a plant fireproof** or "non-flammable". Use `not-rated` unless FireSmart BC or FireSmart Canada gives
   a rating. When you apply a BC rating to the same species in Ontario, put `CA-BC` in `flammability_applied_from`.
4. **Write harm notes in plain words**, one or two sentences, as you'd explain it to a neighbour. Required for
   every invasive plant.
5. Lists inside a cell use semicolons: `full;part`.

## The starter rows
Claude pre-filled 16 species, 17 verdicts and 9 swaps from well-known lists so the app has real data to build on.
**All of them are drafts and none has been checked against the source yet.** In particular, check:
- each swap is actually recommended by Grow Me Instead (Ontario) or the Invasive Species Council of BC
- the two FireSmart BC "low" ratings (Oregon-grape, kinnikinnick) and the ISCBC "high" rating for Scotch broom
- invasive ranks (`high`, `moderate`, `watch`) match the source's wording

## Files and allowed values

### `species.csv` (one row per species)
| Column | What to put |
|---|---|
| `species_id` | The scientific name in lowercase with hyphens: `berberis-thunbergii` |
| `scientific_name`, `common_name_en`, `common_name_fr` | Names; several common names separated by `;` |
| `growth_form` | `tree`, `shrub`, `vine`, `forb`, `grass`, `fern`, `groundcover`, `aquatic` |
| `sun` | `full`, `part`, `shade` (one or more) |
| `moisture` | `dry`, `medium`, `wet` (one or more) |
| `height_min_m`, `height_max_m` | Mature height in metres |
| `bloom_colours` | Plain colour words, `;`-separated |
| `evergreen` | `yes` or `no` |
| `pollinator_value` | `high`, `medium`, `low`, or blank |
| `appearance` | One or two sentences on how it looks (shape, leaves, flowers, fruit, fall colour). Sylvia uses this to find look-alike natives, so be visual and specific. |

### `region_verdicts.csv` (one row per species per region)
| Column | What to put |
|---|---|
| `status` | `native`, `introduced`, `invasive`, `unknown` |
| `invasive_rank` | `high`, `moderate`, `watch` (invasive plants only) |
| `harm_plain` | Plain-language harm (invasive plants only) |
| `flammability` | `low`, `moderate`, `high`, `not-rated` |
| `review_status` | `draft` or `reviewed` |

### `swaps.csv` (native alternatives for an invasive plant, per region)
`why` is one sentence on what the swap gives you: the same look, function or benefit. Both species must exist in
`species.csv`, and the native one needs a `native` verdict in the same region.

### `nurseries.csv` (empty on purpose)
Add only nurseries that appear on the Grow Me Instead nursery list or the FireSmart BC Plant Program retailer list.
`programs` is `grow-me-instead` and/or `firesmart-bc`. Get latitude and longitude from the map pin of their
address. Sylvia never claims a nursery has a plant in stock.

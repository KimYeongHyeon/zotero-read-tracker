# Validation report

## Scope

The **0.2.0 core activity functionality** was validated on 2026-10-06 with Zotero 10.0.5 on macOS in an isolated profile. The test library contained two regular items, one PDF, two notes, and two annotations. Checks used real Zotero APIs and visible UI interactions; the test-control add-on and test data are not included in the release package.

The **0.2.1 English interface** was visually checked in the desktop browser with explicitly labeled synthetic demo data. Headings, filters, months, help text, and the activity timeline are in English. The model and view checks passed after the string changes. The screenshots in this repository contain demo data only.

## Results

| Check | Result | Observed evidence |
| --- | --- | --- |
| Internal tab and menu | PASS | **Tools → Research Activity** opened the internal tab. Repeating the command left one tab. |
| Historical restoration | PASS | Three pre-activation paper, note, and annotation records were restored. A `2025-12-31 16:00` UTC item was counted as `2026-01-01` in KST. |
| Add versus edit | PASS | Adding one paper, note, and annotation after activation produced three observed records. Editing content, duplicate notifications, and repeated collection did not change the count. |
| Active reading | PASS | A reading record appeared after **66.348 seconds** of real document click and keyboard input. Continuing or reopening the same document kept one document-day record. |
| Idle cutoff | PASS | Reading stopped at **119.702 seconds** after the last input; it was unchanged **8 seconds** later. |
| Inactive tab | PASS | Switching from a recently active PDF to the activity tab left **142.648 seconds** unchanged for **16.512 seconds**. |
| Multiple readers | PASS | With two tab/window instances of one PDF and one foreground instance, **6.003 seconds** elapsed and **6.021 seconds** accumulated; one reading record was created. |
| Manual completion | PASS | Clearing the context-menu status produced 0 completed papers and 1 automatic reading record. Restoring it produced 1 completed paper while preserving other `Extra` content. |
| Trash and restore | PASS | Trashing a top-level item removed its child activity. Restoring it returned the same total. |
| Item, PDF, and annotation navigation | PASS | The title selected the source item; document open selected the Reader; annotation open selected the target highlight on PDF page 2. |
| Year, collection, type, and date filters | PASS | 2026 showed 6 records and 2025 showed 1. The reading filter showed 1 record. A parent collection included an item only in its child collection, and multi-collection membership was counted once. |
| Activity triangle | PASS | Empty activity rendered `0/0/0` with an empty axis; save-only rendered `0/0/100`. Equal activity yielded `34/33/33` in a pure-function check. Reading/date filtering did not change the annual ratio. |
| View state | PASS | The selected date and `scrollTop` **385** survived an item-change refresh. The month selector and timeline agreed. |
| Restart | PASS | After app process exit and relaunch, the stored activity array was unchanged and the year, collection, type, and month selection returned. |
| Error and uninstall cleanup | PASS | Corrupted JSON displayed an error and was not overwritten; restoring the original file recovered normal operation. Uninstall removed the tab, Reader input listeners, window listeners, and menus. |
| Midnight, sleep, and DST | PASS (unit checks) | Local-midnight splitting, DST elapsed time, and exclusion of timer gaps over 10 seconds were checked. Actual OS sleep was not executed. |

## Corrections made during validation

- Attached the initial internal-frame load handler in the capture phase so page buttons could reach Zotero; navigation and persisted selection were rechecked.
- Corrected boolean handling for month options and `details`, plus ratio rounding that previously gave every empty category 1%.
- Skipped destroyed PDF frames during cleanup after a trash operation caused a dead-wrapper error. Trash/restore, uninstall, and restart were retested afterward.
- Kept the activity tab out of Zotero session restoration, which supports built-in tabs only, while preserving activity filters separately.
- Explicitly waited for initial item data loading.

An initial multiple-window attempt recorded no time because the foreground window changed or both readers were inactive. That result was not used as evidence. The passing check fixed foreground state and compared focus at both endpoints.

## Reproduce the automated checks

```sh
node tests/activityModel.test.cjs
node tests/activityView.test.cjs
python3 scripts/package.py dist/ZoteroResearchActivity.xpi
```

`verification.json` records the corresponding validation run. The commands test model/view behavior and package integrity; the host/UI results above came from the isolated Zotero profile.

## Not validated

- Other Zotero versions or operating systems.
- Performance with large libraries.
- Real OS sleep or a real midnight crossover.
- Sub-second foreground-window changes; collection observes active state about once per second.
- End-user library installation and GitHub release publication.

An abnormal forced exit can lose reading time since the last periodic save.

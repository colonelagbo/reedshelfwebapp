# ReedShelf Web App

A standalone ReedShelf reading web app.

## Entry point

- `/sign-in` is the app entry point.
- `/register` creates an account.
- `/forgot-password` provides a local password reset flow for the demo app.

## Included

- Facebook-style, simple sign-up/sign-in experience with forgotten-password flow.
- Personal library with cover grid, standing shelf, compact list, and wide-cover layouts.
- Optional original book-cover image upload; supplied cover artwork is preserved without recoloring.
- Profile photo upload, display-name editing, password change, and account statistics.
- Reading plans that ask how many days the reader wants and calculate the daily page target when page count is known.
- Original PDF formatting is preserved in the browser PDF reader.
- Persistent highlight passages can be saved from selected PDF text by copying the selection and using the Highlight button.
- Reader progress auto-save and page navigation.
- Reader and accessibility preferences, dark mode, library layout, text size, line height, auto-save, page numbers, keyboard shortcuts, and sign-out confirmation.
- Sign-out from the application shell.

## Storage note

This prototype stores account data and metadata in browser localStorage and uploaded PDFs in IndexedDB. For production, replace these with a real authentication service, secure password handling, object storage, and a server-side database.

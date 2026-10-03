# PORSH Invoice Generator

A responsive, installable invoice generator based on `Porsh_Studios_Invoice_Concept.pdf`.

## Use locally

The app has no build step and no external dependencies. Start any static file server in this folder, for example:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080`.

Invoice data is saved only in the browser's local storage. Use **Save as PDF** and choose the device's PDF destination in the print window. After confirming that the PDF was saved, the app preserves the invoice-number format and advances its trailing number (for example, `PS-INV-2026-0024` becomes `PS-INV-2026-0025`).

The standard terms and conditions are editable for each invoice. They are restored automatically for the next finalized invoice, and can also be restored manually from the editor.

Taxes are calculated and displayed separately as NHIL, GETFund and VAT. Their percentage rates are editable, and the tax subtotal shows the discounted invoice amount plus the two levies before VAT is added to the total due.

Each invoice item supports a number of days and a daily rate. The line amount is calculated automatically. VAT invoicing can be switched off for an invoice, which removes NHIL, GETFund and VAT from both the calculation and the exported invoice.

Bank and Mobile Money payment details are editable and saved locally with the invoice draft. They are presented in separate Bank Details and Mobile Money sections on the exported document.

The document type can be switched between invoice and receipt. Receipt mode updates the document wording and hides invoice-only due-date and payment-term details in the exported PDF.

The exported document carries the PORSH Studios slogan, “Architects Of Aspiration,” as an italic footer signature.

## Supported devices

- macOS and Windows desktop browsers
- iPhone and iPad Safari
- Android Chrome

When supported by the browser, the app can be installed to the home screen or desktop.

The service worker serves cached app files immediately and refreshes them in the background, so published changes arrive without slowing down the editor on mobile connections.

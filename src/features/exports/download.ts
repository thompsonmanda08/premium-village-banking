const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Hands the bytes to the browser as a file download. Nothing is uploaded or stored; the URL is released after ten seconds (some browsers need it to outlive the click). */
export function downloadBytes(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: XLSX }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

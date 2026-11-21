// Znak AEDostępni (pliki z księgi znaku: brand/logo).
export function Symbol({ size = 32 }: { size?: number }) {
  return <img src="./brand/aedostepni-symbol.svg" width={size} height={size} alt="" aria-hidden="true" />;
}

export function Wordmark() {
  return (
    <span className="wordmark" aria-label="AEDostępni">
      <b>AED</b>ostępni
    </span>
  );
}

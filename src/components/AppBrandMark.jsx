/** In-app brand mark (JF monogram). Keep in sync with index.html icon ?v= */
export const BRAND_ICON_SRC = '/pwa-64x64.png?v=jf2';

export default function AppBrandMark({ size = 24, className = '' }) {
  return (
    <img
      src={BRAND_ICON_SRC}
      alt=""
      width={size}
      height={size}
      className={`rounded-md object-cover ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

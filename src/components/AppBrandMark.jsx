/** In-app brand mark. Keep in sync with index.html icon ?v= (source: public/icon-master.png) */
export const BRAND_ICON_SRC = '/pwa-64x64.png?v=kd1';

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

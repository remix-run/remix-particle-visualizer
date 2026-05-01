import { publicAssetPath } from "~/lib/public-assets";

const runnerAvif = publicAssetPath("landing/remix-runner.avif");
const runnerWebp = publicAssetPath("landing/remix-runner.webp");
const runnerGif = publicAssetPath("landing/remix-runner.gif");
const runnerStatic = publicAssetPath("landing/remix-runner-static.png");

export default function LoaderRunner() {
  return (
    <picture>
      <source media="(prefers-reduced-motion: reduce)" srcSet={runnerStatic} type="image/png" />
      <source srcSet={runnerAvif} type="image/avif" />
      <source srcSet={runnerWebp} type="image/webp" />
      <img
        src={runnerGif}
        alt=""
        width={384}
        height={384}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        style={{ display: "block", width: 48, height: 48, marginBottom: 16 }}
      />
    </picture>
  );
}

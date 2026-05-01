import { publicAssetPath } from "~/lib/public-assets";

export default function LoaderRunner() {
  return (
    <img
      src={publicAssetPath("images/remix-runner.gif")}
      alt=""
      width={48}
      height={48}
      style={{ display: "block", marginBottom: 16, imageRendering: "pixelated" }}
    />
  );
}

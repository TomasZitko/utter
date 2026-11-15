// Brand for the film. Colours come from the app (app/static/tokens.css -> scripts/build_assets.py
// -> generated/brand.json), so a colour change in the app reaches the film on the next asset build.
import { loadFont as loadDisplay } from "@remotion/google-fonts/FamiljenGrotesk";
import { loadFont as loadBody } from "@remotion/google-fonts/InstrumentSans";
import brand from "./generated/brand.json";

export const fontDisplay = loadDisplay("normal", { weights: ["500", "600", "700"], subsets: ["latin"] }).fontFamily;
export const fontBody = loadBody("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;

export const C = brand.colors as {
  page: string; bg: string; surface: string; text: string; muted: string; ink: string;
  line: string; "line-soft": string; "line-mid": string; accent: string; pink: string;
  danger: string; ok: string; ask: string; blue: string;
};

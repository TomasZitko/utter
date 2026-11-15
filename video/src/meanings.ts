// The meanings people pick in the app, copied from app/static/app.js (MEANINGS + the Help quick reply).
// Same labels, colours, icons and sentences, so the film shows exactly what the app offers.
import { Drop, ForkKnife, HandPalm, Lightning, Moon, PersonSimpleWalk, Phone, Pill, Snowflake, TelevisionSimple, ThermometerHot, Toilet, UsersThree } from "@phosphor-icons/react";

export const MEANINGS: Record<string, { icon: typeof Drop; main: string; pale: string; phrase: string }> = {
  Water: { icon: Drop, main: "#4C7DFF", pale: "#C9D8FF", phrase: "Can I have some water, please?" },
  Pain: { icon: Lightning, main: "#F4583E", pale: "#FFC3B5", phrase: "Something hurts. I am in pain." },
  Bathroom: { icon: Toilet, main: "#9A88FF", pale: "#DDD6FF", phrase: "I need to use the bathroom." },
  Food: { icon: ForkKnife, main: "#FF9E5E", pale: "#FFDCC2", phrase: "I'm hungry. Can I eat something?" },
  Walk: { icon: PersonSimpleWalk, main: "#8FD9B0", pale: "#D5F2E2", phrase: "Can we go for a walk?" },
  TV: { icon: TelevisionSimple, main: "#C9A4FF", pale: "#EBDDFF", phrase: "Can you turn on the TV?" },
  Hot: { icon: ThermometerHot, main: "#FF9E5E", pale: "#FFDCC2", phrase: "I'm too hot." },
  Cold: { icon: Snowflake, main: "#8FD3FF", pale: "#D9F0FF", phrase: "I'm cold. Can I have a blanket?" },
  Family: { icon: UsersThree, main: "#F8A4D2", pale: "#FFE0F1", phrase: "I want to see my family." },
  Medicine: { icon: Pill, main: "#4C7DFF", pale: "#C9D8FF", phrase: "I need my medicine." },
  Phone: { icon: Phone, main: "#FFC93C", pale: "#FBEBB0", phrase: "Can you pass me my phone?" },
  Tired: { icon: Moon, main: "#FFC93C", pale: "#FBEBB0", phrase: "I'm tired. I'd like to rest." },
  Help: { icon: HandPalm, main: "#F4583E", pale: "#FFC3B5", phrase: "I need help, please come here." },
};

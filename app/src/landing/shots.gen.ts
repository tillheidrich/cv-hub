// Erzeugt von scripts/landing-shots.mjs am 2026-10-10. Nicht von Hand ändern.
// Neu erzeugen: siehe Kopf von scripts/landing-shots.mjs.
export interface ShotImage { w: number; h: number; v: string; avif: [string, number][]; webp: [string, number][]; png: [string, number] | null }
export interface TextLine { t: string; side: boolean }
export interface TextLayer { template: string; name: string; raw: TextLine[]; layout: TextLine[]; tool: string }
export const SHOTS: Record<string, ShotImage> = {
 "hero-a-de": {
  "w": 2880,
  "h": 1800,
  "avif": [
   [
    "hero-a-de-960.avif",
    960
   ],
   [
    "hero-a-de-1600.avif",
    1600
   ]
  ],
  "webp": [
   [
    "hero-a-de-960.webp",
    960
   ],
   [
    "hero-a-de-1600.webp",
    1600
   ]
  ],
  "png": [
   "hero-a-de-960.png",
   960
  ],
  "v": "13b366bdd9"
 },
 "hero-b-de": {
  "w": 2880,
  "h": 1800,
  "avif": [
   [
    "hero-b-de-960.avif",
    960
   ],
   [
    "hero-b-de-1600.avif",
    1600
   ]
  ],
  "webp": [
   [
    "hero-b-de-960.webp",
    960
   ],
   [
    "hero-b-de-1600.webp",
    1600
   ]
  ],
  "png": null,
  "v": "c06668eb82"
 },
 "design-de": {
  "w": 2280,
  "h": 1800,
  "avif": [
   [
    "design-de-960.avif",
    960
   ],
   [
    "design-de-1440.avif",
    1440
   ]
  ],
  "webp": [
   [
    "design-de-960.webp",
    960
   ],
   [
    "design-de-1440.webp",
    1440
   ]
  ],
  "png": [
   "design-de-960.png",
   960
  ],
  "v": "b693509e2d"
 },
 "hero-c-de": {
  "w": 2880,
  "h": 1800,
  "avif": [
   [
    "hero-c-de-960.avif",
    960
   ],
   [
    "hero-c-de-1600.avif",
    1600
   ]
  ],
  "webp": [
   [
    "hero-c-de-960.webp",
    960
   ],
   [
    "hero-c-de-1600.webp",
    1600
   ]
  ],
  "png": null,
  "v": "3b41aa6849"
 },
 "editor-de": {
  "w": 2280,
  "h": 1800,
  "avif": [
   [
    "editor-de-960.avif",
    960
   ],
   [
    "editor-de-1440.avif",
    1440
   ]
  ],
  "webp": [
   [
    "editor-de-960.webp",
    960
   ],
   [
    "editor-de-1440.webp",
    1440
   ]
  ],
  "png": [
   "editor-de-960.png",
   960
  ],
  "v": "2755025ed8"
 },
 "check-de": {
  "w": 2280,
  "h": 1800,
  "avif": [
   [
    "check-de-960.avif",
    960
   ],
   [
    "check-de-1440.avif",
    1440
   ]
  ],
  "webp": [
   [
    "check-de-960.webp",
    960
   ],
   [
    "check-de-1440.webp",
    1440
   ]
  ],
  "png": [
   "check-de-960.png",
   960
  ],
  "v": "3560dd17fe"
 },
 "export-de": {
  "w": 1880,
  "h": 1800,
  "avif": [
   [
    "export-de-960.avif",
    960
   ],
   [
    "export-de-1440.avif",
    1440
   ]
  ],
  "webp": [
   [
    "export-de-960.webp",
    960
   ],
   [
    "export-de-1440.webp",
    1440
   ]
  ],
  "png": [
   "export-de-960.png",
   960
  ],
  "v": "a995d8c103"
 },
 "phone-de": {
  "w": 780,
  "h": 1688,
  "avif": [
   [
    "phone-de-390.avif",
    390
   ],
   [
    "phone-de-780.avif",
    780
   ]
  ],
  "webp": [
   [
    "phone-de-390.webp",
    390
   ],
   [
    "phone-de-780.webp",
    780
   ]
  ],
  "png": [
   "phone-de-390.png",
   390
  ],
  "v": "db988de6a9"
 },
 "hero-a-en": {
  "w": 2880,
  "h": 1800,
  "avif": [
   [
    "hero-a-en-960.avif",
    960
   ],
   [
    "hero-a-en-1600.avif",
    1600
   ]
  ],
  "webp": [
   [
    "hero-a-en-960.webp",
    960
   ],
   [
    "hero-a-en-1600.webp",
    1600
   ]
  ],
  "png": [
   "hero-a-en-960.png",
   960
  ],
  "v": "171ef61059"
 },
 "hero-b-en": {
  "w": 2880,
  "h": 1800,
  "avif": [
   [
    "hero-b-en-960.avif",
    960
   ],
   [
    "hero-b-en-1600.avif",
    1600
   ]
  ],
  "webp": [
   [
    "hero-b-en-960.webp",
    960
   ],
   [
    "hero-b-en-1600.webp",
    1600
   ]
  ],
  "png": null,
  "v": "8a3dcc4d12"
 },
 "design-en": {
  "w": 2280,
  "h": 1800,
  "avif": [
   [
    "design-en-960.avif",
    960
   ],
   [
    "design-en-1440.avif",
    1440
   ]
  ],
  "webp": [
   [
    "design-en-960.webp",
    960
   ],
   [
    "design-en-1440.webp",
    1440
   ]
  ],
  "png": [
   "design-en-960.png",
   960
  ],
  "v": "e3157251e6"
 },
 "hero-c-en": {
  "w": 2880,
  "h": 1800,
  "avif": [
   [
    "hero-c-en-960.avif",
    960
   ],
   [
    "hero-c-en-1600.avif",
    1600
   ]
  ],
  "webp": [
   [
    "hero-c-en-960.webp",
    960
   ],
   [
    "hero-c-en-1600.webp",
    1600
   ]
  ],
  "png": null,
  "v": "2229902346"
 },
 "editor-en": {
  "w": 2280,
  "h": 1800,
  "avif": [
   [
    "editor-en-960.avif",
    960
   ],
   [
    "editor-en-1440.avif",
    1440
   ]
  ],
  "webp": [
   [
    "editor-en-960.webp",
    960
   ],
   [
    "editor-en-1440.webp",
    1440
   ]
  ],
  "png": [
   "editor-en-960.png",
   960
  ],
  "v": "32ff3b57ff"
 },
 "check-en": {
  "w": 2280,
  "h": 1800,
  "avif": [
   [
    "check-en-960.avif",
    960
   ],
   [
    "check-en-1440.avif",
    1440
   ]
  ],
  "webp": [
   [
    "check-en-960.webp",
    960
   ],
   [
    "check-en-1440.webp",
    1440
   ]
  ],
  "png": [
   "check-en-960.png",
   960
  ],
  "v": "931df1e7f1"
 },
 "export-en": {
  "w": 1880,
  "h": 1800,
  "avif": [
   [
    "export-en-960.avif",
    960
   ],
   [
    "export-en-1440.avif",
    1440
   ]
  ],
  "webp": [
   [
    "export-en-960.webp",
    960
   ],
   [
    "export-en-1440.webp",
    1440
   ]
  ],
  "png": [
   "export-en-960.png",
   960
  ],
  "v": "7a41edfd0b"
 },
 "phone-en": {
  "w": 780,
  "h": 1688,
  "avif": [
   [
    "phone-en-390.avif",
    390
   ],
   [
    "phone-en-780.avif",
    780
   ]
  ],
  "webp": [
   [
    "phone-en-390.webp",
    390
   ],
   [
    "phone-en-780.webp",
    780
   ]
  ],
  "png": [
   "phone-en-390.png",
   390
  ],
  "v": "c9c9e7f60a"
 },
 "hero-a-fr": {
  "w": 2880,
  "h": 1800,
  "avif": [
   [
    "hero-a-fr-960.avif",
    960
   ],
   [
    "hero-a-fr-1600.avif",
    1600
   ]
  ],
  "webp": [
   [
    "hero-a-fr-960.webp",
    960
   ],
   [
    "hero-a-fr-1600.webp",
    1600
   ]
  ],
  "png": [
   "hero-a-fr-960.png",
   960
  ],
  "v": "40e9ed0810"
 },
 "hero-b-fr": {
  "w": 2880,
  "h": 1800,
  "avif": [
   [
    "hero-b-fr-960.avif",
    960
   ],
   [
    "hero-b-fr-1600.avif",
    1600
   ]
  ],
  "webp": [
   [
    "hero-b-fr-960.webp",
    960
   ],
   [
    "hero-b-fr-1600.webp",
    1600
   ]
  ],
  "png": null,
  "v": "59ed7badad"
 },
 "design-fr": {
  "w": 2280,
  "h": 1800,
  "avif": [
   [
    "design-fr-960.avif",
    960
   ],
   [
    "design-fr-1440.avif",
    1440
   ]
  ],
  "webp": [
   [
    "design-fr-960.webp",
    960
   ],
   [
    "design-fr-1440.webp",
    1440
   ]
  ],
  "png": [
   "design-fr-960.png",
   960
  ],
  "v": "90c2266426"
 },
 "hero-c-fr": {
  "w": 2880,
  "h": 1800,
  "avif": [
   [
    "hero-c-fr-960.avif",
    960
   ],
   [
    "hero-c-fr-1600.avif",
    1600
   ]
  ],
  "webp": [
   [
    "hero-c-fr-960.webp",
    960
   ],
   [
    "hero-c-fr-1600.webp",
    1600
   ]
  ],
  "png": null,
  "v": "191ce2dc06"
 },
 "editor-fr": {
  "w": 2280,
  "h": 1800,
  "avif": [
   [
    "editor-fr-960.avif",
    960
   ],
   [
    "editor-fr-1440.avif",
    1440
   ]
  ],
  "webp": [
   [
    "editor-fr-960.webp",
    960
   ],
   [
    "editor-fr-1440.webp",
    1440
   ]
  ],
  "png": [
   "editor-fr-960.png",
   960
  ],
  "v": "bc80d8f257"
 },
 "check-fr": {
  "w": 2280,
  "h": 1800,
  "avif": [
   [
    "check-fr-960.avif",
    960
   ],
   [
    "check-fr-1440.avif",
    1440
   ]
  ],
  "webp": [
   [
    "check-fr-960.webp",
    960
   ],
   [
    "check-fr-1440.webp",
    1440
   ]
  ],
  "png": [
   "check-fr-960.png",
   960
  ],
  "v": "ade75df1cb"
 },
 "export-fr": {
  "w": 1880,
  "h": 1800,
  "avif": [
   [
    "export-fr-960.avif",
    960
   ],
   [
    "export-fr-1440.avif",
    1440
   ]
  ],
  "webp": [
   [
    "export-fr-960.webp",
    960
   ],
   [
    "export-fr-1440.webp",
    1440
   ]
  ],
  "png": [
   "export-fr-960.png",
   960
  ],
  "v": "8c64c31149"
 },
 "phone-fr": {
  "w": 780,
  "h": 1688,
  "avif": [
   [
    "phone-fr-390.avif",
    390
   ],
   [
    "phone-fr-780.avif",
    780
   ]
  ],
  "webp": [
   [
    "phone-fr-390.webp",
    390
   ],
   [
    "phone-fr-780.webp",
    780
   ]
  ],
  "png": [
   "phone-fr-390.png",
   390
  ],
  "v": "3418cd7946"
 },
 "hero-a-es": {
  "w": 2880,
  "h": 1800,
  "avif": [
   [
    "hero-a-es-960.avif",
    960
   ],
   [
    "hero-a-es-1600.avif",
    1600
   ]
  ],
  "webp": [
   [
    "hero-a-es-960.webp",
    960
   ],
   [
    "hero-a-es-1600.webp",
    1600
   ]
  ],
  "png": [
   "hero-a-es-960.png",
   960
  ],
  "v": "7638cffd72"
 },
 "hero-b-es": {
  "w": 2880,
  "h": 1800,
  "avif": [
   [
    "hero-b-es-960.avif",
    960
   ],
   [
    "hero-b-es-1600.avif",
    1600
   ]
  ],
  "webp": [
   [
    "hero-b-es-960.webp",
    960
   ],
   [
    "hero-b-es-1600.webp",
    1600
   ]
  ],
  "png": null,
  "v": "1c90dd4355"
 },
 "design-es": {
  "w": 2280,
  "h": 1800,
  "avif": [
   [
    "design-es-960.avif",
    960
   ],
   [
    "design-es-1440.avif",
    1440
   ]
  ],
  "webp": [
   [
    "design-es-960.webp",
    960
   ],
   [
    "design-es-1440.webp",
    1440
   ]
  ],
  "png": [
   "design-es-960.png",
   960
  ],
  "v": "c45c8aeb86"
 },
 "hero-c-es": {
  "w": 2880,
  "h": 1800,
  "avif": [
   [
    "hero-c-es-960.avif",
    960
   ],
   [
    "hero-c-es-1600.avif",
    1600
   ]
  ],
  "webp": [
   [
    "hero-c-es-960.webp",
    960
   ],
   [
    "hero-c-es-1600.webp",
    1600
   ]
  ],
  "png": null,
  "v": "e341f86842"
 },
 "editor-es": {
  "w": 2280,
  "h": 1800,
  "avif": [
   [
    "editor-es-960.avif",
    960
   ],
   [
    "editor-es-1440.avif",
    1440
   ]
  ],
  "webp": [
   [
    "editor-es-960.webp",
    960
   ],
   [
    "editor-es-1440.webp",
    1440
   ]
  ],
  "png": [
   "editor-es-960.png",
   960
  ],
  "v": "505b7f6bfd"
 },
 "check-es": {
  "w": 2280,
  "h": 1800,
  "avif": [
   [
    "check-es-960.avif",
    960
   ],
   [
    "check-es-1440.avif",
    1440
   ]
  ],
  "webp": [
   [
    "check-es-960.webp",
    960
   ],
   [
    "check-es-1440.webp",
    1440
   ]
  ],
  "png": [
   "check-es-960.png",
   960
  ],
  "v": "e52129744d"
 },
 "export-es": {
  "w": 1880,
  "h": 1800,
  "avif": [
   [
    "export-es-960.avif",
    960
   ],
   [
    "export-es-1440.avif",
    1440
   ]
  ],
  "webp": [
   [
    "export-es-960.webp",
    960
   ],
   [
    "export-es-1440.webp",
    1440
   ]
  ],
  "png": [
   "export-es-960.png",
   960
  ],
  "v": "c7471ec773"
 },
 "phone-es": {
  "w": 780,
  "h": 1688,
  "avif": [
   [
    "phone-es-390.avif",
    390
   ],
   [
    "phone-es-780.avif",
    780
   ]
  ],
  "webp": [
   [
    "phone-es-390.webp",
    390
   ],
   [
    "phone-es-780.webp",
    780
   ]
  ],
  "png": [
   "phone-es-390.png",
   390
  ],
  "v": "1c610f2c5a"
 },
 "thumb-de-hamburg": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-hamburg-300.avif",
    300
   ],
   [
    "thumb-de-hamburg-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-hamburg-300.webp",
    300
   ],
   [
    "thumb-de-hamburg-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "9e14c4b213"
 },
 "thumb-de-kopenhagen": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-kopenhagen-300.avif",
    300
   ],
   [
    "thumb-de-kopenhagen-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-kopenhagen-300.webp",
    300
   ],
   [
    "thumb-de-kopenhagen-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "d9a4ed84f0"
 },
 "thumb-de-oslo": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-oslo-300.avif",
    300
   ],
   [
    "thumb-de-oslo-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-oslo-300.webp",
    300
   ],
   [
    "thumb-de-oslo-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "9ee0348091"
 },
 "thumb-de-berlin": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-berlin-300.avif",
    300
   ],
   [
    "thumb-de-berlin-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-berlin-300.webp",
    300
   ],
   [
    "thumb-de-berlin-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "009d3f3269"
 },
 "thumb-de-wien": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-wien-300.avif",
    300
   ],
   [
    "thumb-de-wien-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-wien-300.webp",
    300
   ],
   [
    "thumb-de-wien-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "d83572d4c1"
 },
 "thumb-de-zuerich": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-zuerich-300.avif",
    300
   ],
   [
    "thumb-de-zuerich-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-zuerich-300.webp",
    300
   ],
   [
    "thumb-de-zuerich-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "2e1d318778"
 },
 "thumb-de-terrakotta": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-terrakotta-300.avif",
    300
   ],
   [
    "thumb-de-terrakotta-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-terrakotta-300.webp",
    300
   ],
   [
    "thumb-de-terrakotta-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "aa10c1ea7f"
 },
 "thumb-de-lissabon": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-lissabon-300.avif",
    300
   ],
   [
    "thumb-de-lissabon-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-lissabon-300.webp",
    300
   ],
   [
    "thumb-de-lissabon-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "81db0b1118"
 },
 "thumb-de-mailand": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-mailand-300.avif",
    300
   ],
   [
    "thumb-de-mailand-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-mailand-300.webp",
    300
   ],
   [
    "thumb-de-mailand-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "3517992d93"
 },
 "thumb-de-bordeaux": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-bordeaux-300.avif",
    300
   ],
   [
    "thumb-de-bordeaux-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-bordeaux-300.webp",
    300
   ],
   [
    "thumb-de-bordeaux-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "85d2a19bd6"
 },
 "thumb-de-amsterdam": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-amsterdam-300.avif",
    300
   ],
   [
    "thumb-de-amsterdam-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-amsterdam-300.webp",
    300
   ],
   [
    "thumb-de-amsterdam-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "a32c67a74d"
 },
 "thumb-de-genf": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-genf-300.avif",
    300
   ],
   [
    "thumb-de-genf-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-genf-300.webp",
    300
   ],
   [
    "thumb-de-genf-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "0c033c0aa1"
 },
 "thumb-de-patterson": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-patterson-300.avif",
    300
   ],
   [
    "thumb-de-patterson-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-patterson-300.webp",
    300
   ],
   [
    "thumb-de-patterson-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "004665a937"
 },
 "thumb-de-karlsruhe": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-karlsruhe-300.avif",
    300
   ],
   [
    "thumb-de-karlsruhe-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-karlsruhe-300.webp",
    300
   ],
   [
    "thumb-de-karlsruhe-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "2ec8a85499"
 },
 "thumb-de-rosenheim": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-rosenheim-300.avif",
    300
   ],
   [
    "thumb-de-rosenheim-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-rosenheim-300.webp",
    300
   ],
   [
    "thumb-de-rosenheim-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "fc607382e0"
 },
 "thumb-de-espoo": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-espoo-300.avif",
    300
   ],
   [
    "thumb-de-espoo-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-espoo-300.webp",
    300
   ],
   [
    "thumb-de-espoo-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "9d6de61db3"
 },
 "thumb-de-seoul": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-seoul-300.avif",
    300
   ],
   [
    "thumb-de-seoul-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-seoul-300.webp",
    300
   ],
   [
    "thumb-de-seoul-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "d3b1b18cd1"
 },
 "thumb-de-lyon": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-lyon-300.avif",
    300
   ],
   [
    "thumb-de-lyon-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-lyon-300.webp",
    300
   ],
   [
    "thumb-de-lyon-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "1b432e4818"
 },
 "thumb-de-lueneburg": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-lueneburg-300.avif",
    300
   ],
   [
    "thumb-de-lueneburg-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-lueneburg-300.webp",
    300
   ],
   [
    "thumb-de-lueneburg-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "bd5f880b27"
 },
 "thumb-de-husum": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-husum-300.avif",
    300
   ],
   [
    "thumb-de-husum-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-husum-300.webp",
    300
   ],
   [
    "thumb-de-husum-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "639359fb28"
 },
 "thumb-de-bregenz": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-bregenz-300.avif",
    300
   ],
   [
    "thumb-de-bregenz-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-bregenz-300.webp",
    300
   ],
   [
    "thumb-de-bregenz-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "62aa18952b"
 },
 "thumb-de-uppsala": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-uppsala-300.avif",
    300
   ],
   [
    "thumb-de-uppsala-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-uppsala-300.webp",
    300
   ],
   [
    "thumb-de-uppsala-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "ed28dc2c77"
 },
 "thumb-de-aarhus": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-aarhus-300.avif",
    300
   ],
   [
    "thumb-de-aarhus-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-aarhus-300.webp",
    300
   ],
   [
    "thumb-de-aarhus-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "9a5347abb5"
 },
 "thumb-de-lille": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-lille-300.avif",
    300
   ],
   [
    "thumb-de-lille-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-lille-300.webp",
    300
   ],
   [
    "thumb-de-lille-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "b1488f4f0f"
 },
 "thumb-de-antwerpen": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-antwerpen-300.avif",
    300
   ],
   [
    "thumb-de-antwerpen-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-antwerpen-300.webp",
    300
   ],
   [
    "thumb-de-antwerpen-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "d02eb05ce4"
 },
 "thumb-de-rotterdam": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-rotterdam-300.avif",
    300
   ],
   [
    "thumb-de-rotterdam-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-rotterdam-300.webp",
    300
   ],
   [
    "thumb-de-rotterdam-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "d32e2e64f8"
 },
 "thumb-de-bamberg": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-bamberg-300.avif",
    300
   ],
   [
    "thumb-de-bamberg-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-bamberg-300.webp",
    300
   ],
   [
    "thumb-de-bamberg-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "cfb4051139"
 },
 "thumb-de-weimar": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-weimar-300.avif",
    300
   ],
   [
    "thumb-de-weimar-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-weimar-300.webp",
    300
   ],
   [
    "thumb-de-weimar-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "0a03b32a67"
 },
 "thumb-de-kiel": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-kiel-300.avif",
    300
   ],
   [
    "thumb-de-kiel-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-kiel-300.webp",
    300
   ],
   [
    "thumb-de-kiel-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "c8408bf979"
 },
 "thumb-de-goettingen": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-goettingen-300.avif",
    300
   ],
   [
    "thumb-de-goettingen-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-goettingen-300.webp",
    300
   ],
   [
    "thumb-de-goettingen-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "81397687a6"
 },
 "thumb-de-bergen": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-bergen-300.avif",
    300
   ],
   [
    "thumb-de-bergen-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-bergen-300.webp",
    300
   ],
   [
    "thumb-de-bergen-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "661152cce5"
 },
 "thumb-de-porto": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-porto-300.avif",
    300
   ],
   [
    "thumb-de-porto-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-porto-300.webp",
    300
   ],
   [
    "thumb-de-porto-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "c52594f362"
 },
 "thumb-de-dublin": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-dublin-300.avif",
    300
   ],
   [
    "thumb-de-dublin-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-dublin-300.webp",
    300
   ],
   [
    "thumb-de-dublin-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "29079c4f53"
 },
 "thumb-de-luxemburg": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-luxemburg-300.avif",
    300
   ],
   [
    "thumb-de-luxemburg-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-luxemburg-300.webp",
    300
   ],
   [
    "thumb-de-luxemburg-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "26e89c1640"
 },
 "thumb-de-freiburg": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-freiburg-300.avif",
    300
   ],
   [
    "thumb-de-freiburg-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-freiburg-300.webp",
    300
   ],
   [
    "thumb-de-freiburg-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "f418c7b29a"
 },
 "thumb-de-tallinn": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-tallinn-300.avif",
    300
   ],
   [
    "thumb-de-tallinn-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-tallinn-300.webp",
    300
   ],
   [
    "thumb-de-tallinn-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "185507188f"
 },
 "thumb-de-graz": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-graz-300.avif",
    300
   ],
   [
    "thumb-de-graz-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-graz-300.webp",
    300
   ],
   [
    "thumb-de-graz-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "27436ec503"
 },
 "thumb-de-linz": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-linz-300.avif",
    300
   ],
   [
    "thumb-de-linz-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-linz-300.webp",
    300
   ],
   [
    "thumb-de-linz-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "c8b266573c"
 },
 "thumb-de-luebeck": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-luebeck-300.avif",
    300
   ],
   [
    "thumb-de-luebeck-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-luebeck-300.webp",
    300
   ],
   [
    "thumb-de-luebeck-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "596be7cc57"
 },
 "thumb-de-valencia": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-de-valencia-300.avif",
    300
   ],
   [
    "thumb-de-valencia-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-de-valencia-300.webp",
    300
   ],
   [
    "thumb-de-valencia-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "b2f5d60d8c"
 },
 "thumb-en-hamburg": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-hamburg-300.avif",
    300
   ],
   [
    "thumb-en-hamburg-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-hamburg-300.webp",
    300
   ],
   [
    "thumb-en-hamburg-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "1cc491a51a"
 },
 "thumb-en-kopenhagen": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-kopenhagen-300.avif",
    300
   ],
   [
    "thumb-en-kopenhagen-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-kopenhagen-300.webp",
    300
   ],
   [
    "thumb-en-kopenhagen-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "36d9a5f953"
 },
 "thumb-en-oslo": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-oslo-300.avif",
    300
   ],
   [
    "thumb-en-oslo-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-oslo-300.webp",
    300
   ],
   [
    "thumb-en-oslo-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "24618c8ef9"
 },
 "thumb-en-berlin": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-berlin-300.avif",
    300
   ],
   [
    "thumb-en-berlin-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-berlin-300.webp",
    300
   ],
   [
    "thumb-en-berlin-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "677327fca5"
 },
 "thumb-en-wien": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-wien-300.avif",
    300
   ],
   [
    "thumb-en-wien-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-wien-300.webp",
    300
   ],
   [
    "thumb-en-wien-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "b2003c2c19"
 },
 "thumb-en-zuerich": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-zuerich-300.avif",
    300
   ],
   [
    "thumb-en-zuerich-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-zuerich-300.webp",
    300
   ],
   [
    "thumb-en-zuerich-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "4d634acb64"
 },
 "thumb-en-terrakotta": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-terrakotta-300.avif",
    300
   ],
   [
    "thumb-en-terrakotta-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-terrakotta-300.webp",
    300
   ],
   [
    "thumb-en-terrakotta-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "9568a5c928"
 },
 "thumb-en-lissabon": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-lissabon-300.avif",
    300
   ],
   [
    "thumb-en-lissabon-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-lissabon-300.webp",
    300
   ],
   [
    "thumb-en-lissabon-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "a541f60786"
 },
 "thumb-en-mailand": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-mailand-300.avif",
    300
   ],
   [
    "thumb-en-mailand-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-mailand-300.webp",
    300
   ],
   [
    "thumb-en-mailand-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "59a495af6f"
 },
 "thumb-en-bordeaux": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-bordeaux-300.avif",
    300
   ],
   [
    "thumb-en-bordeaux-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-bordeaux-300.webp",
    300
   ],
   [
    "thumb-en-bordeaux-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "0a873f08ec"
 },
 "thumb-en-amsterdam": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-amsterdam-300.avif",
    300
   ],
   [
    "thumb-en-amsterdam-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-amsterdam-300.webp",
    300
   ],
   [
    "thumb-en-amsterdam-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "6a5d0c771a"
 },
 "thumb-en-genf": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-genf-300.avif",
    300
   ],
   [
    "thumb-en-genf-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-genf-300.webp",
    300
   ],
   [
    "thumb-en-genf-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "77977535c1"
 },
 "thumb-en-patterson": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-patterson-300.avif",
    300
   ],
   [
    "thumb-en-patterson-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-patterson-300.webp",
    300
   ],
   [
    "thumb-en-patterson-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "40f4854773"
 },
 "thumb-en-karlsruhe": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-karlsruhe-300.avif",
    300
   ],
   [
    "thumb-en-karlsruhe-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-karlsruhe-300.webp",
    300
   ],
   [
    "thumb-en-karlsruhe-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "219ae5d7e2"
 },
 "thumb-en-rosenheim": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-rosenheim-300.avif",
    300
   ],
   [
    "thumb-en-rosenheim-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-rosenheim-300.webp",
    300
   ],
   [
    "thumb-en-rosenheim-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "cd4d84de19"
 },
 "thumb-en-espoo": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-espoo-300.avif",
    300
   ],
   [
    "thumb-en-espoo-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-espoo-300.webp",
    300
   ],
   [
    "thumb-en-espoo-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "4b56947cc9"
 },
 "thumb-en-seoul": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-seoul-300.avif",
    300
   ],
   [
    "thumb-en-seoul-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-seoul-300.webp",
    300
   ],
   [
    "thumb-en-seoul-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "4b94b41184"
 },
 "thumb-en-lyon": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-lyon-300.avif",
    300
   ],
   [
    "thumb-en-lyon-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-lyon-300.webp",
    300
   ],
   [
    "thumb-en-lyon-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "518add8039"
 },
 "thumb-en-lueneburg": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-lueneburg-300.avif",
    300
   ],
   [
    "thumb-en-lueneburg-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-lueneburg-300.webp",
    300
   ],
   [
    "thumb-en-lueneburg-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "d6fb5bdbd1"
 },
 "thumb-en-husum": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-husum-300.avif",
    300
   ],
   [
    "thumb-en-husum-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-husum-300.webp",
    300
   ],
   [
    "thumb-en-husum-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "5ab06c64bd"
 },
 "thumb-en-bregenz": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-bregenz-300.avif",
    300
   ],
   [
    "thumb-en-bregenz-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-bregenz-300.webp",
    300
   ],
   [
    "thumb-en-bregenz-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "64a091867e"
 },
 "thumb-en-uppsala": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-uppsala-300.avif",
    300
   ],
   [
    "thumb-en-uppsala-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-uppsala-300.webp",
    300
   ],
   [
    "thumb-en-uppsala-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "ccf75c2702"
 },
 "thumb-en-aarhus": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-aarhus-300.avif",
    300
   ],
   [
    "thumb-en-aarhus-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-aarhus-300.webp",
    300
   ],
   [
    "thumb-en-aarhus-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "6a1bc91fa5"
 },
 "thumb-en-lille": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-lille-300.avif",
    300
   ],
   [
    "thumb-en-lille-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-lille-300.webp",
    300
   ],
   [
    "thumb-en-lille-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "5f2be600fa"
 },
 "thumb-en-antwerpen": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-antwerpen-300.avif",
    300
   ],
   [
    "thumb-en-antwerpen-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-antwerpen-300.webp",
    300
   ],
   [
    "thumb-en-antwerpen-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "fbf90a4e1d"
 },
 "thumb-en-rotterdam": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-rotterdam-300.avif",
    300
   ],
   [
    "thumb-en-rotterdam-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-rotterdam-300.webp",
    300
   ],
   [
    "thumb-en-rotterdam-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "e1af92648c"
 },
 "thumb-en-bamberg": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-bamberg-300.avif",
    300
   ],
   [
    "thumb-en-bamberg-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-bamberg-300.webp",
    300
   ],
   [
    "thumb-en-bamberg-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "5c4bf02de3"
 },
 "thumb-en-weimar": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-weimar-300.avif",
    300
   ],
   [
    "thumb-en-weimar-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-weimar-300.webp",
    300
   ],
   [
    "thumb-en-weimar-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "d5cdb883e0"
 },
 "thumb-en-kiel": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-kiel-300.avif",
    300
   ],
   [
    "thumb-en-kiel-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-kiel-300.webp",
    300
   ],
   [
    "thumb-en-kiel-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "85d7430b59"
 },
 "thumb-en-goettingen": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-goettingen-300.avif",
    300
   ],
   [
    "thumb-en-goettingen-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-goettingen-300.webp",
    300
   ],
   [
    "thumb-en-goettingen-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "e1d8a31d74"
 },
 "thumb-en-bergen": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-bergen-300.avif",
    300
   ],
   [
    "thumb-en-bergen-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-bergen-300.webp",
    300
   ],
   [
    "thumb-en-bergen-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "72fea59994"
 },
 "thumb-en-porto": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-porto-300.avif",
    300
   ],
   [
    "thumb-en-porto-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-porto-300.webp",
    300
   ],
   [
    "thumb-en-porto-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "d24221eaf2"
 },
 "thumb-en-dublin": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-dublin-300.avif",
    300
   ],
   [
    "thumb-en-dublin-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-dublin-300.webp",
    300
   ],
   [
    "thumb-en-dublin-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "606b74d74c"
 },
 "thumb-en-luxemburg": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-luxemburg-300.avif",
    300
   ],
   [
    "thumb-en-luxemburg-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-luxemburg-300.webp",
    300
   ],
   [
    "thumb-en-luxemburg-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "2ac02aa6ca"
 },
 "thumb-en-freiburg": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-freiburg-300.avif",
    300
   ],
   [
    "thumb-en-freiburg-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-freiburg-300.webp",
    300
   ],
   [
    "thumb-en-freiburg-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "c8a4a482a1"
 },
 "thumb-en-tallinn": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-tallinn-300.avif",
    300
   ],
   [
    "thumb-en-tallinn-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-tallinn-300.webp",
    300
   ],
   [
    "thumb-en-tallinn-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "44824ad418"
 },
 "thumb-en-graz": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-graz-300.avif",
    300
   ],
   [
    "thumb-en-graz-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-graz-300.webp",
    300
   ],
   [
    "thumb-en-graz-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "6539c01d8b"
 },
 "thumb-en-linz": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-linz-300.avif",
    300
   ],
   [
    "thumb-en-linz-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-linz-300.webp",
    300
   ],
   [
    "thumb-en-linz-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "4f41886be0"
 },
 "thumb-en-luebeck": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-luebeck-300.avif",
    300
   ],
   [
    "thumb-en-luebeck-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-luebeck-300.webp",
    300
   ],
   [
    "thumb-en-luebeck-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "770da0d546"
 },
 "thumb-en-valencia": {
  "w": 794,
  "h": 1123,
  "avif": [
   [
    "thumb-en-valencia-300.avif",
    300
   ],
   [
    "thumb-en-valencia-440.avif",
    440
   ]
  ],
  "webp": [
   [
    "thumb-en-valencia-300.webp",
    300
   ],
   [
    "thumb-en-valencia-440.webp",
    440
   ]
  ],
  "png": null,
  "v": "c27b63a4d6"
 }
};
export const TEXTLAYER: Record<string, TextLayer> = {
 "de": {
  "template": "hamburg",
  "name": "Hamburg",
  "raw": [
   {
    "t": "Lena Brandt",
    "side": false
   },
   {
    "t": "SENIOR PRODUCT DESIGNER",
    "side": false
   },
   {
    "t": "Senior Product Designer mit sieben Jahren Erfahrung in B2B-SaaS und E-",
    "side": false
   },
   {
    "t": "Commerce. Schwerpunkte: skalierbare Design Systems, Research-getriebene",
    "side": false
   },
   {
    "t": "Produktentwicklung und enge Zusammenarbeit mit Engineering — vom ersten",
    "side": false
   },
   {
    "t": "Wireframe bis zum produktiven Feature.",
    "side": false
   },
   {
    "t": "BERUFSERFAHRUNG",
    "side": false
   },
   {
    "t": "Senior Product Designer",
    "side": false
   },
   {
    "t": "Nordhub GmbH · Hamburg",
    "side": false
   },
   {
    "t": "01/2023 – heute",
    "side": false
   },
   {
    "t": "Verantwortung für das Design System (Figma + Tokens, ausgerollt auf vier",
    "side": false
   },
   {
    "t": "Produktbereiche)",
    "side": false
   },
   {
    "t": "Discovery- und Delivery-Phasen für drei Kernfeatures geleitet — von User",
    "side": false
   },
   {
    "t": "Interviews bis zur Hi-Fi-Spezifikation",
    "side": false
   },
   {
    "t": "Onboarding-Flow überarbeitet: Aktivierungsrate (Day-7) laut Analytics-",
    "side": false
   },
   {
    "t": "Team deutlich verbessert",
    "side": false
   }
  ],
  "layout": [
   {
    "t": "Lena Brandt",
    "side": false
   },
   {
    "t": "SENIOR PRODUCT DESIGNER",
    "side": false
   },
   {
    "t": "Senior Product Designer mit sieben Jahren Erfahrung in B2B-SaaS und ECommerce. Schwerpunkte: skalierbare Design Systems, Research-getriebene",
    "side": false
   },
   {
    "t": "Produktentwicklung und enge Zusammenarbeit mit Engineering — vom ersten",
    "side": false
   },
   {
    "t": "Wireframe bis zum produktiven Feature.",
    "side": false
   },
   {
    "t": "BERUFSERFAHRUNG",
    "side": false
   },
   {
    "t": "Senior Product Designer",
    "side": false
   },
   {
    "t": "PERSÖNLICHES",
    "side": true
   },
   {
    "t": "E-MAIL",
    "side": true
   },
   {
    "t": "lena.brandt@example.com",
    "side": true
   },
   {
    "t": "01/2023 – heute",
    "side": false
   },
   {
    "t": "Nordhub GmbH · Hamburg",
    "side": false
   },
   {
    "t": "Verantwortung für das Design System (Figma + Tokens, ausgerollt auf vier",
    "side": false
   },
   {
    "t": "Produktbereiche)",
    "side": false
   },
   {
    "t": "TELEFON",
    "side": true
   },
   {
    "t": "Discovery- und Delivery-Phasen für drei Kernfeatures geleitet — von User",
    "side": false
   }
  ],
  "tool": "pdftotext version 24.02.0"
 },
 "en": {
  "template": "hamburg",
  "name": "Hamburg",
  "raw": [
   {
    "t": "Lena Brandt",
    "side": false
   },
   {
    "t": "SENIOR PRODUCT DESIGNER",
    "side": false
   },
   {
    "t": "Senior product designer with seven years of experience across B2B SaaS and",
    "side": false
   },
   {
    "t": "e-commerce. I focus on scalable design systems, research-driven product",
    "side": false
   },
   {
    "t": "work and close collaboration with engineering — from the first wireframe to",
    "side": false
   },
   {
    "t": "the shipped feature.",
    "side": false
   },
   {
    "t": "PROFESSIONAL EXPERIENCE",
    "side": false
   },
   {
    "t": "Senior Product Designer",
    "side": false
   },
   {
    "t": "Nordhub GmbH · Hamburg",
    "side": false
   },
   {
    "t": "01/2023 – today",
    "side": false
   },
   {
    "t": "Owner of the design system (Figma + tokens) rolled out across four",
    "side": false
   },
   {
    "t": "product areas",
    "side": false
   },
   {
    "t": "Led discovery and delivery for three core features — from user interviews",
    "side": false
   },
   {
    "t": "to hi-fi specs",
    "side": false
   },
   {
    "t": "Reworked the onboarding flow; analytics team reported a clear day-7",
    "side": false
   },
   {
    "t": "activation lift",
    "side": false
   }
  ],
  "layout": [
   {
    "t": "Lena Brandt",
    "side": false
   },
   {
    "t": "SENIOR PRODUCT DESIGNER",
    "side": false
   },
   {
    "t": "Senior product designer with seven years of experience across B2B SaaS and",
    "side": false
   },
   {
    "t": "e-commerce. I focus on scalable design systems, research-driven product",
    "side": false
   },
   {
    "t": "work and close collaboration with engineering — from the first wireframe to",
    "side": false
   },
   {
    "t": "the shipped feature.",
    "side": false
   },
   {
    "t": "PROFESSIONAL EXPERIENCE",
    "side": false
   },
   {
    "t": "Senior Product Designer",
    "side": false
   },
   {
    "t": "CONTACT",
    "side": true
   },
   {
    "t": "EMAIL",
    "side": true
   },
   {
    "t": "lena.brandt@example.com",
    "side": true
   },
   {
    "t": "01/2023 – today",
    "side": false
   },
   {
    "t": "Nordhub GmbH · Hamburg",
    "side": false
   },
   {
    "t": "Owner of the design system (Figma + tokens) rolled out across four",
    "side": false
   },
   {
    "t": "product areas",
    "side": false
   },
   {
    "t": "PHONE",
    "side": true
   }
  ],
  "tool": "pdftotext version 24.02.0"
 },
 "fr": {
  "template": "hamburg",
  "name": "Hamburg",
  "raw": [
   {
    "t": "Lena Brandt",
    "side": false
   },
   {
    "t": "SENIOR PRODUCT DESIGNER",
    "side": false
   },
   {
    "t": "Senior Product Designer mit sieben Jahren Erfahrung in B2B-SaaS und E-",
    "side": false
   },
   {
    "t": "Commerce. Schwerpunkte: skalierbare Design Systems, Research-getriebene",
    "side": false
   },
   {
    "t": "Produktentwicklung und enge Zusammenarbeit mit Engineering — vom ersten",
    "side": false
   },
   {
    "t": "Wireframe bis zum produktiven Feature.",
    "side": false
   },
   {
    "t": "EXPÉRIENCE PROFESSIONNELLE",
    "side": false
   },
   {
    "t": "Senior Product Designer",
    "side": false
   },
   {
    "t": "Nordhub GmbH · Hamburg",
    "side": false
   },
   {
    "t": "01/2023 – à ce jour",
    "side": false
   },
   {
    "t": "Verantwortung für das Design System (Figma + Tokens, ausgerollt auf vier",
    "side": false
   },
   {
    "t": "Produktbereiche)",
    "side": false
   },
   {
    "t": "Discovery- und Delivery-Phasen für drei Kernfeatures geleitet — von User",
    "side": false
   },
   {
    "t": "Interviews bis zur Hi-Fi-Spezifikation",
    "side": false
   },
   {
    "t": "Onboarding-Flow überarbeitet: Aktivierungsrate (Day-7) laut Analytics-",
    "side": false
   },
   {
    "t": "Team deutlich verbessert",
    "side": false
   }
  ],
  "layout": [
   {
    "t": "Lena Brandt",
    "side": false
   },
   {
    "t": "SENIOR PRODUCT DESIGNER",
    "side": false
   },
   {
    "t": "Senior Product Designer mit sieben Jahren Erfahrung in B2B-SaaS und ECommerce. Schwerpunkte: skalierbare Design Systems, Research-getriebene",
    "side": false
   },
   {
    "t": "Produktentwicklung und enge Zusammenarbeit mit Engineering — vom ersten",
    "side": false
   },
   {
    "t": "Wireframe bis zum produktiven Feature.",
    "side": false
   },
   {
    "t": "EXPÉRIENCE PROFESSIONNELLE",
    "side": false
   },
   {
    "t": "Senior Product Designer",
    "side": false
   },
   {
    "t": "CONTACT",
    "side": true
   },
   {
    "t": "E-MAIL",
    "side": true
   },
   {
    "t": "lena.brandt@example.com",
    "side": true
   },
   {
    "t": "01/2023 – à ce jour",
    "side": false
   },
   {
    "t": "Nordhub GmbH · Hamburg",
    "side": false
   },
   {
    "t": "Verantwortung für das Design System (Figma + Tokens, ausgerollt auf vier",
    "side": false
   },
   {
    "t": "Produktbereiche)",
    "side": false
   },
   {
    "t": "TÉLÉPHONE",
    "side": true
   },
   {
    "t": "Discovery- und Delivery-Phasen für drei Kernfeatures geleitet — von User",
    "side": false
   }
  ],
  "tool": "pdftotext version 24.02.0"
 },
 "es": {
  "template": "hamburg",
  "name": "Hamburg",
  "raw": [
   {
    "t": "Lena Brandt",
    "side": false
   },
   {
    "t": "SENIOR PRODUCT DESIGNER",
    "side": false
   },
   {
    "t": "Senior Product Designer mit sieben Jahren Erfahrung in B2B-SaaS und E-",
    "side": false
   },
   {
    "t": "Commerce. Schwerpunkte: skalierbare Design Systems, Research-getriebene",
    "side": false
   },
   {
    "t": "Produktentwicklung und enge Zusammenarbeit mit Engineering — vom ersten",
    "side": false
   },
   {
    "t": "Wireframe bis zum produktiven Feature.",
    "side": false
   },
   {
    "t": "EXPERIENCIA PROFESIONAL",
    "side": false
   },
   {
    "t": "Senior Product Designer",
    "side": false
   },
   {
    "t": "Nordhub GmbH · Hamburg",
    "side": false
   },
   {
    "t": "01/2023 – actualidad",
    "side": false
   },
   {
    "t": "Verantwortung für das Design System (Figma + Tokens, ausgerollt auf vier",
    "side": false
   },
   {
    "t": "Produktbereiche)",
    "side": false
   },
   {
    "t": "Discovery- und Delivery-Phasen für drei Kernfeatures geleitet — von User",
    "side": false
   },
   {
    "t": "Interviews bis zur Hi-Fi-Spezifikation",
    "side": false
   },
   {
    "t": "Onboarding-Flow überarbeitet: Aktivierungsrate (Day-7) laut Analytics-",
    "side": false
   },
   {
    "t": "Team deutlich verbessert",
    "side": false
   }
  ],
  "layout": [
   {
    "t": "Lena Brandt",
    "side": false
   },
   {
    "t": "SENIOR PRODUCT DESIGNER",
    "side": false
   },
   {
    "t": "Senior Product Designer mit sieben Jahren Erfahrung in B2B-SaaS und ECommerce. Schwerpunkte: skalierbare Design Systems, Research-getriebene",
    "side": false
   },
   {
    "t": "Produktentwicklung und enge Zusammenarbeit mit Engineering — vom ersten",
    "side": false
   },
   {
    "t": "Wireframe bis zum produktiven Feature.",
    "side": false
   },
   {
    "t": "EXPERIENCIA PROFESIONAL",
    "side": false
   },
   {
    "t": "Senior Product Designer",
    "side": false
   },
   {
    "t": "CONTACTO",
    "side": true
   },
   {
    "t": "CORREO ELECTRÓNICO",
    "side": true
   },
   {
    "t": "lena.brandt@example.com",
    "side": true
   },
   {
    "t": "01/2023 – actualidad",
    "side": false
   },
   {
    "t": "Nordhub GmbH · Hamburg",
    "side": false
   },
   {
    "t": "Verantwortung für das Design System (Figma + Tokens, ausgerollt auf vier",
    "side": false
   },
   {
    "t": "Produktbereiche)",
    "side": false
   },
   {
    "t": "TELÉFONO",
    "side": true
   },
   {
    "t": "Discovery- und Delivery-Phasen für drei Kernfeatures geleitet — von User",
    "side": false
   }
  ],
  "tool": "pdftotext version 24.02.0"
 }
};
export const SHOT_TEMPLATES: string[] = ["hamburg","kopenhagen","oslo","berlin","wien","zuerich","terrakotta","lissabon","mailand","bordeaux","amsterdam","genf","patterson","karlsruhe","rosenheim","espoo","seoul","lyon","lueneburg","husum","bregenz","uppsala","aarhus","lille","antwerpen","rotterdam","bamberg","weimar","kiel","goettingen","bergen","porto","dublin","luxemburg","freiburg","tallinn","graz","linz","luebeck","valencia"];

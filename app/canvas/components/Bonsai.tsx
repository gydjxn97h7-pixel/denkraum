"use client";

// ── Bonsai — an illustrated, painted-style tree on a stone, on a wooden board ──
// Hand-built SVG meant to read as a loose watercolor sketch, not a geometric
// icon: an S-curving tapered trunk, irregular layered branches, and loose
// cloud-like foliage in our nature greens with lighter highlights inside darker
// masses. Roots fan out and grip the stone. Works on a light / transparent
// background and stays legible down to ~80–100px tall. Purely decorative.

// Palette (kept inline so the mark is self-contained).
const BARK = "#5E4A34";
const BARK_DARK = "#4A3A28";
const WOOD = "#8A6E50";
const MOSS = "#5C6B4A";
const FERN = "#8A9E72";
const SAGE = "#B8C9A0";
const STONE = "#C9C5B8";
const STONE_DARK = "#8E8A82";
const STONE_LIGHT = "#E6E2D8";

export function Bonsai({ size = 96 }: { size?: number }) {
  // viewBox is 200 × 210 (portrait); height drives the rendered size.
  return (
    <svg
      width={(size * 200) / 210}
      height={size}
      viewBox="0 0 200 210"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      {/* ── Wooden board with legs ── */}
      {/* back legs (behind the slab) */}
      <rect x="62" y="190" width="6" height="17" rx="1.5" fill={BARK} />
      <rect x="132" y="190" width="6" height="17" rx="1.5" fill={BARK} />
      {/* slab */}
      <rect x="34" y="183" width="134" height="11" rx="3.5" fill={WOOD} />
      {/* slab front shadow */}
      <path
        d="M34 189 q0 5 5 5 h124 q5 0 5 -5 v3 q0 5 -5 5 H39 q-5 0 -5 -5 Z"
        fill={BARK}
        opacity="0.45"
      />
      {/* grain hint on the slab top */}
      <path
        d="M46 187 h40 M96 188 h54"
        stroke={BARK}
        strokeWidth="0.8"
        opacity="0.3"
        strokeLinecap="round"
      />
      {/* front legs */}
      <rect x="50" y="193" width="8" height="16" rx="2" fill="#6E573E" />
      <rect x="144" y="193" width="8" height="16" rx="2" fill="#6E573E" />

      {/* ── Angular stone ── */}
      <path
        d="M70 184 L63 166 L75 152 L96 147 L119 149 L132 161 L135 178 L124 185 Z"
        fill={STONE}
      />
      {/* darker lower-left facet */}
      <path d="M70 184 L63 166 L83 170 L88 185 Z" fill={STONE_DARK} opacity="0.7" />
      {/* lighter top facet */}
      <path
        d="M75 152 L96 147 L119 149 L107 160 L85 160 Z"
        fill={STONE_LIGHT}
        opacity="0.9"
      />
      {/* rough angular edges */}
      <path
        d="M83 170 L107 160 L132 161 M88 185 L107 160"
        stroke={STONE_DARK}
        strokeWidth="0.9"
        opacity="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* moss at the stone base */}
      <path
        d="M82 184 q12 -6 26 -2 q8 2 18 0 q-6 5 -18 5 q-16 1 -26 -3 Z"
        fill={FERN}
        opacity="0.8"
      />
      <ellipse cx="100" cy="184" rx="9" ry="2.4" fill={MOSS} opacity="0.55" />

      {/* ── Exposed roots gripping the stone ── */}
      <path
        d="M99 150 C90 158 82 166 76 177 C81 179 87 176 91 167 C95 159 99 155 100 150 Z"
        fill="#6E573E"
      />
      <path
        d="M104 150 C111 160 119 167 125 176 C121 179 113 176 108 167 C104 159 102 154 104 150 Z"
        fill={BARK}
      />
      <path
        d="M100 152 C99 162 99 172 101 181 C104 181 106 178 105 169 C104 159 103 154 100 152 Z"
        fill={WOOD}
      />

      {/* ── Trunk (S-curve, thick base tapering up, leaning) ── */}
      <path
        d="M86 161
           C79 147 79 127 95 115
           C104 108 101 95 107 85
           C109 81 113 78 117 78
           C119 81 117 86 113 90
           C107 99 110 108 110 120
           C111 135 121 149 113 161
           C104 166 93 166 86 161 Z"
        fill={BARK}
      />
      {/* sunlit (wood) highlight along the right of the trunk */}
      <path
        d="M110 120 C111 135 119 149 113 160 C111 161 109 160 109 157
           C113 147 107 135 107 122 C107 112 106 104 110 96
           C112 92 114 90 115 91 C112 101 109 110 110 120 Z"
        fill={WOOD}
        opacity="0.9"
      />
      {/* bark texture streaks */}
      <path
        d="M92 152 C90 139 92 127 100 118 M99 153 C98 142 100 131 105 122"
        stroke={BARK_DARK}
        strokeWidth="1.2"
        opacity="0.45"
        fill="none"
        strokeLinecap="round"
      />

      {/* ── Branches (horizontal, layered, curving up at the tips) ── */}
      <g fill="none" strokeLinecap="round">
        {/* lower-left, long */}
        <path
          d="M95 127 C79 124 65 127 54 120 C51 118 50 114 51 110"
          stroke={BARK}
          strokeWidth="4.6"
        />
        {/* right, medium */}
        <path
          d="M107 107 C125 105 141 108 153 100 C156 98 157 94 156 90"
          stroke={BARK}
          strokeWidth="4.4"
        />
        {/* upper-left, short */}
        <path
          d="M104 91 C91 89 81 90 73 84 C71 82 71 79 72 76"
          stroke="#6E573E"
          strokeWidth="3.4"
        />
        {/* low-right, short */}
        <path
          d="M110 141 C125 141 137 143 145 137 C147 135 148 132 147 129"
          stroke="#6E573E"
          strokeWidth="3"
        />
      </g>

      {/* ── Foliage — loose cloud masses; moss base, fern mid, sage highlights ── */}
      {/* Crown (top) */}
      <g>
        <path
          d="M80 58 C72 41 95 29 112 36 C125 25 148 33 147 50 C162 54 155 75 138 73
             C133 85 110 85 103 74 C86 82 76 72 80 58 Z"
          fill={MOSS}
        />
        <path
          d="M85 54 C79 41 98 33 112 40 C124 31 142 38 140 52 C151 56 145 70 132 67
             C127 76 109 76 103 67 C91 73 83 65 85 54 Z"
          fill={FERN}
          opacity="0.95"
        />
        <ellipse cx="101" cy="46" rx="9" ry="6.4" fill={SAGE} opacity="0.9" />
        <ellipse cx="125" cy="49" rx="7" ry="5" fill={SAGE} opacity="0.85" />
        <ellipse cx="113" cy="57" rx="6" ry="4" fill={SAGE} opacity="0.55" />
      </g>

      {/* Left branch mass */}
      <g>
        <path
          d="M28 110 C24 97 39 89 52 93 C58 84 75 89 74 101 C83 106 78 121 65 118
             C60 126 44 125 41 117 C30 119 26 116 28 110 Z"
          fill={MOSS}
        />
        <path
          d="M33 107 C30 97 43 91 53 95 C59 88 71 93 70 103 C77 107 73 117 63 115
             C58 121 46 121 44 114 C36 116 31 112 33 107 Z"
          fill={FERN}
          opacity="0.95"
        />
        <ellipse cx="46" cy="100" rx="7.5" ry="5" fill={SAGE} opacity="0.85" />
        <ellipse cx="62" cy="104" rx="5" ry="3.6" fill={SAGE} opacity="0.55" />
      </g>

      {/* Right branch mass */}
      <g>
        <path
          d="M132 92 C129 79 145 72 158 78 C166 71 181 78 178 90 C187 95 180 109 168 105
             C163 113 147 112 144 103 C134 104 130 99 132 92 Z"
          fill={MOSS}
        />
        <path
          d="M137 90 C135 80 148 75 158 80 C165 74 176 80 173 90 C180 95 174 105 164 102
             C160 108 148 107 146 100 C139 101 135 96 137 90 Z"
          fill={FERN}
          opacity="0.95"
        />
        <ellipse cx="152" cy="85" rx="7.5" ry="5" fill={SAGE} opacity="0.85" />
        <ellipse cx="168" cy="90" rx="5" ry="3.6" fill={SAGE} opacity="0.5" />
      </g>

      {/* Upper-left small mass */}
      <g>
        <path
          d="M52 74 C49 64 62 58 72 63 C79 57 90 63 87 73 C94 78 87 89 77 85
             C72 91 60 89 58 82 C50 83 49 78 52 74 Z"
          fill={MOSS}
        />
        <ellipse cx="68" cy="72" rx="9" ry="6" fill={FERN} opacity="0.95" />
        <ellipse cx="66" cy="69" rx="5.5" ry="3.6" fill={SAGE} opacity="0.8" />
      </g>

      {/* Low-right small mass */}
      <g>
        <path
          d="M135 138 C133 129 145 124 154 128 C161 124 170 130 167 138 C172 143 165 151 157 147
             C153 152 143 151 141 145 C135 145 133 142 135 138 Z"
          fill={MOSS}
          opacity="0.95"
        />
        <ellipse cx="150" cy="135" rx="7" ry="4.6" fill={FERN} opacity="0.95" />
        <ellipse cx="148" cy="133" rx="4.5" ry="3" fill={SAGE} opacity="0.7" />
      </g>
    </svg>
  );
}

export default {
  "name": "isosceles triangle with a point D on the base, two circles centered at the vertex and at C, angle at C labeled α is the target angle to solve for",
      "points": [
    {
      "id": "A",
      "x": 553,
      "y": 360
    },
    {
      "id": "B",
      "x": 353,
      "y": 360
    },
    {
      "id": "C",
      "x": 720,
      "y": 248
    },
    {
      "id": "D",
      "x": 885,
      "y": 360
    },
    {
      "id": "E",
      "x": 253,
      "y": 360
    }
  ],
  "edges": [
    {
      "p": [
        "A",
        "B"
      ]
    },
    {
      "p": [
        "C",
        "A"
      ]
    },
    {
      "p": [
        "A",
        "D"
      ]
    },
    {
      "p": [
        "B",
        "E"
      ]
    },
    {
      "p": [
        "D",
        "C"
      ]
    },
    {
      "p": [
        "C",
        "B"
      ]
    }
  ],
  "circles": [
    {
      "id": "A",
      "x": 553,
      "y": 360,
      "r": 200,
      "p": [
        "B",
        "C"
      ]
    },
    {
      "id": "C",
      "x": 720,
      "y": 248,
      "r": 201,
      "p": [
        "A",
        "D"
      ]
    }
  ],
  "angles": [
    {
      "id": "B",
      "p": [
        "E",
        "C"
      ],
      "v": "141"
    },
    {
      "id": "A",
      "p": [
        "B",
        "C"
      ]
    },
    {
      "id": "C",
      "p": [
        "D",
        "B"
      ]
    },
    {
      "id": "C",
      "p": [
        "A",
        "D"
      ],
      "v": "?",
      "l": "α"
    },
    {
      "id": "A",
      "p": [
        "C",
        "D"
      ]
    },
    {
      "id": "D",
      "p": [
        "A",
        "C"
      ]
    },
    {
      "id": "C",
      "p": [
        "A",
        "B"
      ]
    },
    {
      "id": "B",
      "p": [
        "A",
        "C"
      ]
    }
  ],
  "lines": [
    [
      "E",
      "B",
      "A",
      "D"
    ]
  ]
}
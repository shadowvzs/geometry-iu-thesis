export default {
    "name": "Triangle with 2 angles given and no circles, vertex angle have an additional edge which intersect with base edge, cannot be solved all angle but can be solved the angle which is the target angle",
  "points": [
    {
      "id": "A",
      "x": 195,
      "y": 235
    },
    {
      "id": "B",
      "x": 116,
      "y": 439
    },
    {
      "id": "C",
      "x": 464,
      "y": 417
    },
    {
      "id": "D",
      "x": 212,
      "y": 433
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
        "B",
        "C"
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
        "B",
        "D"
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
        "A",
        "D"
      ]
    }
  ],
  "circles": [],
  "angles": [
    {
      "id": "B",
      "p": [
        "A",
        "C"
      ],
      "v": "50"
    },
    {
      "id": "C",
      "p": [
        "B",
        "A"
      ],
      "v": "?",
      "l": "α"
    },
    {
      "id": "A",
      "p": [
        "B",
        "C"
      ],
      "v": "70"
    },
    {
      "id": "B",
      "p": [
        "A",
        "D"
      ]
    },
    {
      "id": "C",
      "p": [
        "A",
        "D"
      ]
    },
    {
      "id": "A",
      "p": [
        "C",
        "D"
      ]
    },
    {
      "id": "A",
      "p": [
        "B",
        "D"
      ]
    },
    {
      "id": "D",
      "p": [
        "C",
        "A"
      ]
    },
    {
      "id": "D",
      "p": [
        "B",
        "A"
      ]
    }
  ],
  "lines": [
    [
      "B",
      "D",
      "C"
    ]
  ]
}
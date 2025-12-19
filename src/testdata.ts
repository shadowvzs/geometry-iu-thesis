export const testdata = {
  "name": "Test data with a complex triangle, where we have ISOSCELES triangles and a circle, multiple composed angles",
  "points": [
      { "id": "A", "x": 409, "y": 117 },
      { "id": "B", "x": 532, "y": 374 },
      { "id": "C", "x": 293, "y": 376 },
      { "id": "D", "x": 476, "y": 257 },
      { "id": "E", "x": 493, "y": 292 }
  ],
  "edges": [
      { "p": ["A", "C"] },
      { "p": ["C", "B"] },
      { "p": ["A", "D"] },
      { "p": ["C", "D"] },
      { "p": ["D", "E"] },
      { "p": ["E", "B"] },
      { "p": ["E", "C"] }
  ],
  "circles": [
      {
          "id": "A",
          "r": 285,
          "p": ["B", "C"]
      }
  ],
  "angles": [
      { "id": "A", "p": ["B", "C"], "v": "44" },
      { "id": "C", "p": ["A", "B"], "h": 1 },
      { "id": "B", "p": ["A", "C"], "h": 1 },
      { "id": "B", "p": ["C", "D"] },
      { "id": "A", "p": ["C", "D"] },
      { "id": "C", "p": ["A", "D"], "l": "α", "h": 1 },
      { "id": "C", "p": ["B", "D"], "l": "α", "h": 1 },
      { "id": "D", "p": ["A", "C"], "h": 1 },
      { "id": "D", "p": ["B", "C"], "h": 1 },
      { "id": "D", "p": ["C", "E"] },
      { "id": "B", "p": ["C", "E"] },
      { "id": "E", "p": ["B", "C"], "v": "90" },
      { "id": "E", "p": ["D", "C"], "h": 1 },
      { "id": "C", "p": ["A", "E"], "h": 1 },
      { "id": "C", "p": ["B", "E"], "h": 1 },
      { "id": "C", "p": ["D", "E"], "t": 1 }
  ],
  "lines": [
      ["A", "D", "E", "B"]
  ]
}

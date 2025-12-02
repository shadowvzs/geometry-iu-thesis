export default {
    "name": "ABC triangle with two angles labeled the same, one angle known which is labeled is given",
    "points": [
        { "id": "A", "x": 442, "y": 257 },
        { "id": "B", "x": 337, "y": 420 },
        { "id": "C", "x": 546, "y": 430 }
    ],
    "edges": [
        { "p": ["A","C"] },
        { "p": ["C","B"] },
        { "p": ["B","A"] }
    ],
    "circles": [],
    "angles": [
        { "id": "C", "p": ["A","B"], "l": "α" },
        { "id": "B", "p": ["C","A"], "v": "44", "l": "α" },
        { "id": "A", "p": ["C","B"] }
    ],
    "lines": []
};

export default {
    "name": "ABC triangle with two angles labeled the same, one angle known which have no label",
    "points": [
        { "id": "A", "x": 436, "y": 254 },
        { "id": "B", "x": 282, "y": 444 },
        { "id": "C", "x": 522, "y": 479 }
    ],
    "edges": [
        { "p": ["A","C"] },
        { "p": ["C","B"] },
        { "p": ["B","A"] }
    ],
    "circles": [],
    "angles": [
        { "id": "C", "p": ["A","B"], "l": "α" },
        { "id": "B", "p": ["C","A"], "l": "α" },
        { "id": "A", "p": ["C","B"], "v": "92" }
    ],
    "lines": []
};

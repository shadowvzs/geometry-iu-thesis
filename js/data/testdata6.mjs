export default {
    "name": "ABC triangle with one base angle known, isosceles with a circle",
    "points": [
        { "id": "A", "x": 487, "y": 181 },
        { "id": "B", "x": 338, "y": 294 },
        { "id": "C", "x": 592, "y": 334 }
    ],
    "edges": [
        { "p": ["A","B"] },
        { "p": ["B","C"] },
        { "p": ["C","A"] }
    ],
    "circles": [
        { "id": "A", "x": 487, "y": 181, "r": 187, "p": ["B","C"] }
    ],
    "angles": [
        { "id": "B", "p": ["A","C"], "v": "44" },
        { "id": "C", "p": ["B","A"] },
        { "id": "A", "p": ["B","C"] }
    ],
    "lines": []
};

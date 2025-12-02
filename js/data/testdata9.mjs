export default {
    "name": "ABC triangle with two angles known, no labels or circle",
    "points": [
        { "id": "A", "x": 478, "y": 230 },
        { "id": "B", "x": 300, "y": 440 },
        { "id": "C", "x": 585, "y": 490 }
    ],
    "edges": [
        { "p": ["A","C"] },
        { "p": ["C","B"] },
        { "p": ["B","A"] }
    ],
    "circles": [],
    "angles": [
        { "id": "C", "p": ["A","B"], "v": "55" },
        { "id": "B", "p": ["C","A"], "v": "33" },
        { "id": "A", "p": ["C","B"] }
    ],
    "lines": []
};

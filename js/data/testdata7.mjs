export default {
    "name": "ABC triangle which have a point D on AB, angles at ACD and CDB are given (supplementary with CDA)",
    "points": [
        { "id": "A", "x": 169, "y": 370 },
        { "id": "B", "x": 528, "y": 383 },
        { "id": "C", "x": 206, "y": 184 },
        { "id": "D", "x": 415, "y": 379 }
    ],
    "edges": [
        { "p": ["A","B"] },
        { "p": ["A","D"] },
        { "p": ["D","B"] },
        { "p": ["C","A"] },
        { "p": ["C","D"] },
        { "p": ["C","B"] }
    ],
    "circles": [],
    "angles": [
        { "id": "A", "p": ["D","C"] },
        { "id": "C", "p": ["A","D"], "v": "55" },
        { "id": "D", "p": ["B","C"], "v": "130" },
        { "id": "D", "p": ["A","C"] },
        { "id": "C", "p": ["A","B"] },
        { "id": "C", "p": ["D","B"] },
        { "id": "B", "p": ["D","C"], "v": "29" },
        { "id": "A", "p": ["B","C"] },
        { "id": "B", "p": ["A","C"] }
    ],
    "lines": [["A","D","B"]]
};

# Geometry Problem-Solving Tool

An interactive web-based geometry problem-solving tool that enables users to create and solve geometric angle problems through an algorithmic approach. Built with TypeScript and zero external dependencies.

## 🎯 Project Overview

This project implements a dual-mode geometry tool:
- **Creator Mode**: Interactive problem creation with visual feedback
- **Solver Mode**: Automatic angle problem solving using rule-based algorithms

The system implements seven distinct geometric rules for angle problem solving and uses calculated angle values for relationship detection rather than direct solving—a key architectural decision.

## 🛠️ Technology Stack

- **TypeScript 5.3.3**: Type-safe development with compile-time error checking
- **Vite 5.4.11**: Fast build tool and development server with HMR
- **SVG**: Scalable vector graphics for rendering geometric elements
- **Zero External Dependencies**: Pure TypeScript implementation

### Why This Stack?

- **TypeScript**: Prevents runtime errors from typos and type mismatches, significantly reducing debugging time
- **Vite**: Fast development experience with native ES modules and efficient production builds
- **SVG**: Enables interactive, scalable graphics with direct DOM manipulation
- **No Dependencies**: Lightweight, easily deployable, and full control over the codebase

## 📁 Project Structure

```
src/
├── main.ts                 # Entry point, mode selection
├── GeometryTool.ts        # Base class for Creator/Solver
├── Creator.ts             # Creator mode implementation
├── Solver.ts              # Solver mode implementation
├── MessagingHub.ts        # Event-driven communication system
├── types.ts               # TypeScript type definitions
│
├── rules/                 # Solving algorithms
│   ├── applyTriangleAngleSum.ts
│   ├── applySupplementaryAngles.ts
│   ├── applySameLabelAngles.ts
│   ├── applySameAngles.ts
│   ├── applyComposedAngles.ts
│   ├── applyMirrorAngle.ts
│   ├── applyFullAngleSum.ts
│   └── extractEquations.ts
│
├── UI/                    # User interface components
│   ├── Canvas.ts          # SVG canvas management
│   ├── Toolbar.ts         # Mode-specific toolbars
│   ├── PanelManager.ts    # Draggable panel system
│   ├── panels/            # Panel implementations
│   └── popover/           # Angle editing popover
│
├── utils/                 # Utility functions
│   ├── solve.ts           # Main solving engine
│   ├── mathHelper.ts      # Geometric calculations
│   ├── angleValidation.ts # Constraint checking
│   ├── dataSerializer.ts  # Problem export/import
│   └── ...
│
└── data/                  # Test data
    └── testdata*.json     # Test cases
```

## 🏗️ Architecture

### Core Design Patterns

#### 1. **Inheritance-Based Mode System**
```typescript
GeometryTool (base class)
├── Creator (extends GeometryTool)
└── Solver (extends GeometryTool)
```

The base `GeometryTool` class provides common functionality:
- Canvas management and SVG rendering
- State management (points, edges, circles, angles, lines)
- History system (undo/redo)
- Message hub integration

#### 2. **Messaging Hub Pattern**
Event-driven communication between components:
```typescript
messagingHub.emit(Messages.CANVAS_CLICKED, { event });
messagingHub.subscribe(Messages.POINT_CLICKED, handler);
```

This enables loose coupling and easier testing.

#### 3. **Iterative Rule-Based Solving**
The solving engine applies geometric rules iteratively until no more progress can be made:

```typescript
while (changesMade && iterations < maxIterations) {
    for (const solverMethod of angleSolverMethods) {
        if (solverMethod(data, setAngle)) {
            changesMade = true;
        }
    }
}
```

### Key Data Structures

#### Angle
```typescript
interface Angle {
    id: string;
    pointId: string;              // Vertex point
    sidepoints: [string, string]; // Two side points
    value?: number | null;        // Solved/assigned value
    calculatedValue?: number;     // Geometric calculated value (for relationships)
    label?: string;               // User label (α, β, γ)
    name: string;                 // Display name (∠ABC)
    target?: boolean;             // Target angle to solve
    // ... rendering properties
}
```

**Critical Distinction**: `value` is used for solving, while `calculatedValue` is used for relationship detection (e.g., validating composed angles).

## 🔧 Key Components

### Solving Engine (`src/utils/solve.ts`)

The core solving algorithm that orchestrates rule application:

1. **Initialization**: Builds data structures and maps for efficient lookup
2. **Iteration Loop**: Applies rules in sequence until convergence
3. **Validation**: Ensures geometric consistency after each change
4. **Termination**: Stops when all targets solved or no progress possible

**Rule Application Order**:
1. Same Label Angles (foundational)
2. Same Angles (foundational)
3. Supplementary Angles (medium complexity)
4. Full Angle Sum (high complexity)
5. Triangle Angle Sum (high complexity)
6. Composed Angles (medium complexity)
7. Mirror Angles (lower complexity)

### Geometric Rules (`src/rules/`)

Each rule is a pure function following the interface:
```typescript
(data: SolveDataWithMaps, log: LogFn): boolean
```

Returns `true` if any changes were made.

#### Notable Implementations

**`applySupplementaryAngles.ts`**: Most complex rule
- Uses line-based collinearity detection
- Validates point ordering to distinguish supplementary from overlapping angles
- Recursive path finding to identify valid angle combinations
- Geometric validation using calculated values

**`applyComposedAngles.ts`**: Demonstrates calculated value usage
- Uses `calculatedValue` to validate parent-child relationships
- Solves based on `value` (assigned values)
- Handles labeled angles (α, β, γ)

### SVG Rendering System

**Element Ordering** (critical for clickability):
1. Circle group (lowest)
2. Edge group
3. Angle group (dynamically sorted by size)
4. Point group (highest)

Angles are sorted by size (smallest first) to ensure all angles remain clickable even when overlapping.

**Data Attributes**: Used for performance optimization:
```typescript
angleArc.setAttribute('data-angle-id', angle.id);
angleArc.setAttribute('data-angle-name', angle.name);
```

### UI Components

**Canvas** (`src/UI/Canvas.ts`):
- Manages SVG rendering with layer-based organization
- Handles user interactions (clicks, drags)
- Updates geometry in real-time

**Toolbar** (`src/UI/Toolbar.ts`):
- Mode-specific tools
- Visual feedback for active tools
- Original SVG icons (no external dependencies)

**Panels** (`src/UI/panels/`):
- Draggable, resizable panels
- Definitions, JSON, Debug, Results panels
- Panel manager handles positioning and visibility

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd geometry

# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev

# Type checking
npm run typecheck

# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

### Usage

**Creator Mode** (default):
```
http://localhost:5173/
```

**Solver Mode**:
```
http://localhost:5173/?mode=solver&problem=<base64-encoded-problem>
```

## 🔬 Key Algorithms

### Angle Calculation

Geometric angles are calculated from point coordinates:
```typescript
function getAngleCalculatedInfo(vertex, point1, point2) {
    let angle1 = Math.atan2(point1.y - vertex.y, point1.x - vertex.x);
    let angle2 = Math.atan2(point2.y - vertex.y, point2.x - vertex.x);
    let angleDiff = normalizeAngle(angle2 - angle1);
    return radiansToDegrees(angleDiff);
}
```

### Supplementary Angle Detection

1. Identifies vertices on lines (not at endpoints)
2. Separates rays into "before" and "after" sides
3. Recursive path finding to find valid angle combinations
4. Geometric validation using calculated values (sums to ~180°)

### Composed Angle Detection

1. Finds all valid parent-child decompositions
2. Validates using calculated values: `childrenSum ≈ parent.calculatedValue`
3. Solves based on assigned values: `parent.value = sum(childValues)`

## 🧪 Testing

Test cases are stored in `src/data/testdata*.json`. The test runner (`src/runTests.ts`) validates:
- Problem solvability
- Geometric consistency
- Algorithm correctness

Run tests:
```bash
npm test
```

## 📊 Performance Considerations

- **Efficient Data Structures**: Maps for O(1) angle lookup by vertex
- **Early Termination**: Stops when all targets solved
- **Data Attributes**: Reduces DOM queries
- **SVG Grouping**: Minimizes DOM manipulation
- **Iteration Limits**: Prevents infinite loops (max 100 iterations)

## 🔍 Technical Decisions

### Why Calculated Values for Relationships?

Using `calculatedValue` for relationship detection (not solving) allows:
- Geometric validation of relationships
- Distinguishing valid from invalid angle compositions
- Maintaining separation between geometric measurements and solved values

### Why Line-Based Supplementary Detection?

Explicit line definitions with point ordering:
- Ensures accuracy (no false positives)
- Handles complex configurations
- Validates geometrically using calculated values

### Why Zero Dependencies?

- Lightweight deployment
- Full control over codebase
- No licensing concerns
- Faster load times
- Easier maintenance

## 🐛 Known Limitations

1. **Line Definition Requirement**: Supplementary angles require explicit line definitions
2. **Rule-Based Limitations**: May not solve all possible geometric configurations
3. **2D Only**: Limited to two-dimensional Euclidean geometry
4. **Point Ordering Sensitivity**: Supplementary detection sensitive to point ordering

## 📝 Development Notes

### Adding a New Rule

1. Create file in `src/rules/`
2. Implement function: `(data: SolveDataWithMaps, log: LogFn): boolean`
3. Add to `angleSolverMethods` array in `src/utils/solve.ts`
4. Add score in `scores` object

### SVG Element Management

Always add elements to appropriate groups:
- Circles → `circleGroup`
- Edges → `edgeGroup`
- Angles → `angleGroup` (will be sorted)
- Points → `pointGroup`

Use data attributes for performance:
```typescript
element.setAttribute('data-angle-id', angle.id);
```

## 📄 License

[Specify your license here]

## 🤝 Contributing

[Contributing guidelines if applicable]

## 📚 Related Documentation

- See `egyetem/Thesis_Final.html` for comprehensive academic documentation
- See `egyetem/thesis_analysis.html` for detailed project analysis

---

**Built with TypeScript, Vite, and SVG. Zero external dependencies.**


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
├── solver-algorithm/      # Dual solving approach
│   ├── index.ts           # Main solver orchestrator
│   ├── theorems/          # Rule-based theorem solving
│   │   ├── index.ts       # Theorem solver orchestrator
│   │   ├── applyTriangleAngleSum.ts
│   │   ├── applySupplementaryAngles.ts
│   │   ├── applySameLabelAngles.ts
│   │   ├── applySameAngles.ts
│   │   ├── applyComposedAngles.ts
│   │   ├── applyMirrorAngle.ts
│   │   └── applyFullAngleSum.ts
│   └── equations/         # Linear equation solving
│       ├── index.ts       # Equation solver orchestrator
│       ├── extractEquations.ts
│       ├── solveWithEquationHybrid.ts
│       └── solveWithEquationsRREF.ts
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

### Solving Engine Architecture

The system uses a **dual-solving approach** combining rule-based theorem solving and linear equation solving:

#### 1. Theorem-Based Solver (`src/solver-algorithm/theorems/`)

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

Each rule is a pure function following the interface:
```typescript
(data: SolveDataWithMaps, log: LogFn): boolean
```

Returns `true` if any changes were made.

#### 2. Equation-Based Solver (`src/solver-algorithm/equations/`)

A complementary approach that extracts geometric relationships as linear equations and solves them using linear algebra:

**Process**:
1. **Extract Equations**: Converts geometric relationships to linear equations
   - Triangle angle sums: `a+b+c=180`
   - Equal angles: `a=b`
   - Composed angles: `a=b+c`
   - Known values: `a=45`
2. **Simplify**: Maps angle names to single-character variables (a-z, α-ω)
3. **Solve**: Uses two parallel methods:
   - **Hybrid Solver**: Symbolic substitution + RREF (faster for simple cases)
   - **RREF Solver**: Pure Reduced Row Echelon Form (handles all cases)
4. **Apply Solutions**: Automatically sets angle values via `setAngle` callback

**Return Structure**:
```typescript
interface EquationSolverResult {
    hybrid: SolvedEquation;  // Hybrid solver result
    rref: SolvedEquation;     // RREF solver result
}

interface SolvedEquation {
    solved: boolean;           // All targets solved?
    allSolved: boolean;        // All variables solved?
    score: number;             // Number of variables
    executionTime: number;     // Performance metric
    solution: Record<string, number>;  // Variable → value mapping
}
```

**Key Features**:
- **Target-based solving**: Only requires target angles to be solved
- **Unified number formatting**: Consistent precision across both solvers
- **Automatic application**: Solutions are automatically applied to angles
- **Dual verification**: Both solvers run in parallel for validation

#### Notable Implementations

**`applySupplementaryAngles.ts`**: Most complex theorem rule
- Uses line-based collinearity detection
- Validates point ordering to distinguish supplementary from overlapping angles
- Recursive path finding to identify valid angle combinations
- Geometric validation using calculated values

**`applyComposedAngles.ts`**: Demonstrates calculated value usage
- Uses `calculatedValue` to validate parent-child relationships
- Solves based on `value` (assigned values)
- Handles labeled angles (α, β, γ)

**`solveWithEquationHybrid.ts`**: Efficient hybrid solver
- Auto-detects variables (supports Unicode, Greek letters, multi-character)
- Three-phase approach: substitution → RREF → final evaluation
- Optimized for cases with many simple equations

**`solveWithEquationsRREF.ts`**: Complete RREF solver
- Handles all linear systems (unique, infinite, inconsistent)
- Detects free variables and inconsistent systems
- Pure matrix-based approach

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

### Equation Extraction and Solving

**Equation Extraction** (`extractEquations.ts`):
1. Extracts 10 types of geometric relationships:
   - Triangle angle sums
   - Supplementary angles (180°)
   - Composed angles
   - Equal angles (vertical, same label)
   - Isosceles triangle relationships
   - Mirror angles
   - Full circle (360°)
   - Known values
   - Label assignments
2. Converts to string equations: `"a+b+c=180"`, `"a=b"`, etc.

**Equation Simplification**:
- Maps angle names (e.g., `∠ABC`) to single characters (e.g., `a`)
- Groups equal angles together (same variable)
- Handles Greek letters and Unicode identifiers

**Hybrid Solving** (`solveWithEquationHybrid`):
1. **Phase 1 - Substitution**: Solves equations of form `x = constant`
2. **Phase 2 - RREF**: Uses Gaussian elimination for remaining system
3. **Phase 3 - Final Evaluation**: Solves equations with one unknown
4. **Number Formatting**: Snaps near-integers and rounds to 7 decimals

**RREF Solving** (`solveWithEquationsRREF`):
1. Builds augmented matrix from equations
2. Performs Reduced Row Echelon Form (Gauss-Jordan elimination)
3. Extracts solutions from pivot columns
4. Detects inconsistent systems and free variables

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
- **Dual Solving**: Theorem and equation solvers run in parallel
- **Hybrid Optimization**: Symbolic substitution before RREF reduces matrix size
- **Unified Formatting**: Single number formatting function for consistency
- **Data Attributes**: Reduces DOM queries
- **SVG Grouping**: Minimizes DOM manipulation
- **Iteration Limits**: Prevents infinite loops (max 100 iterations)

### Solver Performance

**Theorem Solver**:
- Best for: Problems with clear geometric relationships
- Typical time: < 10ms for most problems
- Iterative approach with early termination

**Equation Solvers**:
- **Hybrid**: Typically 0.5-1ms (fastest for simple systems)
- **RREF**: Typically 0.5-2ms (handles all cases)
- Both run in parallel for verification
- Automatic solution application via `setAngle` callback

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

### Adding a New Theorem Rule

1. Create file in `src/solver-algorithm/theorems/`
2. Implement function: `(data: SolveDataWithMaps, log: LogFn): boolean`
3. Add to solver methods array in `src/solver-algorithm/theorems/index.ts`
4. Add score in `scores` object

### Adding a New Equation Type

1. Add extraction function in `src/solver-algorithm/equations/extractEquations.ts`
2. Call it from `extractEquations()` function
3. Ensure equations follow format: `"variable1+variable2=constant"` or `"variable1=variable2"`
4. Both solvers will automatically handle the new equation type

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


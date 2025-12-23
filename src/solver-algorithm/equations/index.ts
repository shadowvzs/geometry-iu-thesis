import { Angle, EquationSolverResult, SolveData, SolveOptions } from "@/types";
import { equationsToAugmentedMatrix, extractEquations, simplifyEquations } from "./extractEquations";
import { solveWithEquationHybrid } from "./solveWithEquationHybrid";
import { solveWithEquationsRREF } from "./solveWithEquationsRREF";
import { getAngleMapsByPointId } from "@/utils/mathHelper";

export const solveWithEquations = (data: SolveData, options: SolveOptions): EquationSolverResult => {
    const angleMapsByPointId = getAngleMapsByPointId(data.angles);
    const dataWithMaps = { ...data, angleMapsByPointId };
    const equations = extractEquations(dataWithMaps);
    const { equations: simplifiedEquations, mapping, reverseMapping } = simplifyEquations(equations, dataWithMaps);
    const augmentedMatrix = equationsToAugmentedMatrix(simplifiedEquations);

    const targets = data.angles
        .filter(angle => angle.target)
        .map(angle => angle.name)
        .map(name => mapping.get(name))
        .filter(name => name !== undefined) as string[];
    const hybridSolution = solveWithEquationHybrid(simplifiedEquations, targets);
    const rrefSolution = solveWithEquationsRREF(augmentedMatrix, targets);
    if (options.setAngle) {
        const setAngle = options.setAngle;
        const unifiedSolutions = { ...hybridSolution.solution, ...rrefSolution.solution };
        const angleMap = new Map<string, Angle>();
        data.angles.forEach(angle => {
            angleMap.set(angle.name, angle);
        });

        for (const [name, value] of Object.entries(unifiedSolutions)) {
            const angleNames = reverseMapping.get(name);
            if (!angleNames) { continue; }
            angleNames
                .map(name => angleMap.get(name))
                .filter(angle => angle !== undefined)
                .forEach(angle => {
                    if (typeof angle.value !== 'number') { 
                        angle.value = value;
                    }
                    setAngle(angle, `Solved by equations, ${name} = ${value}°`, `equation`);
                });
        }
    }


    
    return {
        hybrid: hybridSolution,
        rref: rrefSolution,
    };
}
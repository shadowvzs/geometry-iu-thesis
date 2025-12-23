import testdata from './data/index';
import { deserializeGeometryData, enrichGeometryData, validateGeometryData } from './utils/dataSerializer';
import { solve } from './solver-algorithm';
import type { Angle, SerializedGeometryData, SolverResults } from './types';

interface TestResult {
    name: string;
    result: SolverResults;
    anglesCount: number;
    solvedAngles: number;
    targetAngles: number;
    targetSolved: number;
}

const runAllTests = () => {
    console.log('='.repeat(80));
    console.log('GEOMETRY SOLVER TEST RUNNER');
    console.log('='.repeat(80));
    console.log('');

    const results: TestResult[] = [];

    testdata.forEach((data, index) => {
        const testName = (data as { name?: string }).name || `testdata${index + 1}`;
        console.log(`\n[${ index + 1 }/${ testdata.length }] Testing: ${testName}`);
        console.log('-'.repeat(60));

        try {
            // Deserialize and normalize the data
            const normalizedData = deserializeGeometryData(data as SerializedGeometryData);
            
            // Validate the data
            const validation = validateGeometryData(normalizedData);
            if (!validation.isValid) {
                console.log(`  ❌ Validation failed: ${validation.errors.join(', ')}`);
                return;
            }

            // Enrich the data
            const enrichedData = enrichGeometryData(normalizedData, 1);

            // Count angles
            const anglesCount = enrichedData.angles.length;
            const targetAngles = enrichedData.angles.filter(a => a.target).length;
            const anglesWithValue = enrichedData.angles.filter(a => a.value != null).length;

            console.log(`  📐 Angles: ${anglesCount} total, ${anglesWithValue} with known values, ${targetAngles} targets`);
            console.log(`  📊 Triangles: ${enrichedData.triangles.length}`);
            console.log(`  📏 Lines: ${enrichedData.lines.length}`);

            // Run solver
            const solveResult = solve(
                {
                    angles: enrichedData.angles,
                    points: enrichedData.points,
                    lines: enrichedData.lines,
                    triangles: enrichedData.triangles,
                    circles: enrichedData.circles,
                    adjacentPoints: enrichedData.adjacentPoints,
                },
                {
                    setAngle: (angle: Angle, _reason: string, ruleName: string) => {
                        console.log(`    ✓ Solved ${angle.name}: ${angle.value}° (${ruleName})`);
                    }
                }
            );

            const solvedAngles = enrichedData.angles.filter(a => a.value != null).length;
            const targetSolved = enrichedData.angles.filter(a => a.target && a.value != null).length;

            results.push({
                name: testName,
                result: solveResult,
                anglesCount,
                solvedAngles,
                targetAngles,
                targetSolved,
            });

            // Print result
            console.log(`\n  Results:`);
            console.log(`    Iterations: ${solveResult.score}`);
            console.log(`    Time: ${solveResult.executionTime.toFixed(2)}ms`);
            // console.log(`    Valid: ${solveResult.isValid ? '✅' : '❌'}`);
            // console.log(`    Solved: ${solvedAngles}/${anglesCount} angles`);
            if (targetAngles > 0) {
                console.log(`    Targets: ${targetSolved}/${targetAngles} solved`);
            }
            // console.log(`    All Solved: ${solveResult.allSolved ? '✅' : '❌'}`);
            console.log(`    Score: ${solveResult.score}`);

        } catch (error) {
            console.log(`  ❌ Error: ${error}`);
        }
    });

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    
    const passed = results.filter(r => r.targetAngles > 0 && r.targetSolved === r.targetAngles);
    const failed = results.filter(r => r.targetAngles === 0 || r.targetSolved !== r.targetAngles);

    console.log(`\nTotal: ${results.length} tests`);
    console.log(`Passed: ${passed.length} ✅`);
    console.log(`Failed: ${failed.length} ❌`);

    if (failed.length > 0) {
        console.log('\nFailed tests:');
        failed.forEach(f => {
            console.log(`  - ${f.name}: ${f.solvedAngles}/${f.anglesCount} solved`);
        });
    }

    console.log('\n' + '='.repeat(80));
};

runAllTests();


import 'dotenv/config';
import { GoalAnalyzerGraph } from './goal-analyzer.graph';
async function main() {


  const graph = new GoalAnalyzerGraph();
  const goal = 'I want to learn Docker and Kubernetes to enhance my DevOps skills.';
  const result = await graph.analyzeGoal(goal);
  console.log('Input Goal:', goal);
  console.log('GoalAnalyzerGraph output:', JSON.stringify(result, null, 2));
}

main().catch(console.error);

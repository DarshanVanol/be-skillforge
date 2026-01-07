import { BaseMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Injectable, Logger } from "@nestjs/common";
import { BroadGoalAnnotation } from "./broad.goal.annotation";
import { StateGraph } from "@langchain/langgraph";
import { GoalAnalyzerAnnotation } from "./state.annotation";


@Injectable()
class BroadGoalGraph {
    private readonly name = 'Broad Goal Graph';

    private readonly logger = new Logger(BroadGoalGraph.name);


    private topicGenerationSystemMessage() {
        //TODO: Implement this method
        return ``;
    }

    private topicGeneratorModel() {
        const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            this.logger.warn('Google GenAI API key not found. Set GOOGLE_GENAI_API_KEY or GOOGLE_API_KEY in environment.');
        }
        return new ChatGoogleGenerativeAI({
            model: 'gemini-2.0-flash-lite',
            disableStreaming: true,
            apiKey,
        });
    }

    private initialize() {
        this.logger.log('Initializing Broad Goal Graph...');
        // Initialization logic here
    }


  private async addMessages(
    state: typeof BroadGoalAnnotation.State,
    messages: BaseMessage[],
  ) {
    state.messages.push(...messages);
  }


    private topicGenerator() {
        this.logger.log('Generating topics for broad goal...');
        // Topic generation logic here
    }

    private toolExecution() {
        this.logger.log('Executing tools for broad goal...');
        // Tool execution logic here
    }

    private compile() {
        const stateGraph = new StateGraph(
            GoalAnalyzerAnnotation ,
        );

        return stateGraph
            .addNode('initialize', this.initialize.bind(this))
            .addNode('topicGenerator', this.topicGenerator.bind(this))
            .addNode('toolExecution', this.toolExecution.bind(this))
            .addEdge('initialize', 'topicGenerator')
            .addEdge('topicGenerator', 'toolExecution')
            .compile();
    }

    graph() {
        return this.compile();
    }


}



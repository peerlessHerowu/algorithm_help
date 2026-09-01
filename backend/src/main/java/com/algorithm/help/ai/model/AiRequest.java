package com.algorithm.help.ai.model;

import com.algorithm.help.entity.Problem;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * AI 请求模型
 */
@Data
@Accessors(chain = true)
public class AiRequest {

    public enum RequestType {
        EXPLANATION, TRANSFORM, DIAGRAM, CHAT, DETECT_ERRORS, LEVELED_EXPLANATION
    }

    public enum Source {
        REALTIME, BATCH
    }

    private RequestType type;
    private Problem problem;
    private GenerateOptions options;
    private String content;
    private String algorithmType;
    private String diagramType;
    private String inputData;
    private Source source = Source.REALTIME;

    public static AiRequest forExplanation(Problem problem, GenerateOptions options) {
        return new AiRequest()
            .setType(RequestType.EXPLANATION)
            .setProblem(problem)
            .setOptions(options);
    }

    public static AiRequest forDiagram(String algorithmType, String diagramType, String inputData) {
        return new AiRequest()
            .setType(RequestType.DIAGRAM)
            .setAlgorithmType(algorithmType)
            .setDiagramType(diagramType)
            .setInputData(inputData);
    }
}

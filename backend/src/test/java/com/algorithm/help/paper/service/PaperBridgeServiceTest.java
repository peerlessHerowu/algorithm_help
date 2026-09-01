package com.algorithm.help.paper.service;

import com.algorithm.help.paper.dto.PaperBridgeDTO;
import com.algorithm.help.paper.entity.PaperBridge;
import com.algorithm.help.paper.enums.FrontierDomain;
import com.algorithm.help.paper.repository.PaperBridgeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * PaperBridgeService 降级策略单元测试
 */
@ExtendWith(MockitoExtension.class)
class PaperBridgeServiceTest {

    @Mock
    private PaperBridgeRepository bridgeRepo;

    @InjectMocks
    private PaperBridgeService service;

    private PaperBridge testBridge;

    @BeforeEach
    void setUp() {
        testBridge = new PaperBridge()
                .setId("bfs-to-gcn")
                .setBaseAlgorithm("BFS")
                .setPaperTitle("GCN Paper")
                .setDomain(FrontierDomain.CV)
                .setExperimentType("COLAB")
                .setExperimentUrl("https://colab.example.com/gcn")
                .setLeveledInterpretation(Map.of(
                        3, "GCN可以理解为带学习能力的BFS",
                        4, "即将支持",
                        5, "即将支持"
                ));
    }

    @Test
    @DisplayName("请求 L3 级别时返回 available 状态")
    void getById_level3_returnsAvailable() {
        when(bridgeRepo.findById("bfs-to-gcn")).thenReturn(Optional.of(testBridge));

        PaperBridgeDTO dto = service.getById("bfs-to-gcn", 3);

        assertThat(dto.getStatus()).isEqualTo("available");
        assertThat(dto.getSelectedInterpretation()).isEqualTo("GCN可以理解为带学习能力的BFS");
        assertThat(dto.getMessage()).isNull();
        assertThat(dto.getL3Available()).isTrue();
        assertThat(dto.getL4Available()).isFalse();
        assertThat(dto.getL5Available()).isFalse();
    }

    @Test
    @DisplayName("请求 L4 级别（不可用）时返回 coming_soon 状态")
    void getById_level4_returnsComingSoon() {
        when(bridgeRepo.findById("bfs-to-gcn")).thenReturn(Optional.of(testBridge));

        PaperBridgeDTO dto = service.getById("bfs-to-gcn", 4);

        assertThat(dto.getStatus()).isEqualTo("coming_soon");
        assertThat(dto.getMessage()).isEqualTo("即将支持");
        assertThat(dto.getSelectedInterpretation()).isNull();
        assertThat(dto.getL4Available()).isFalse();
    }

    @Test
    @DisplayName("请求 L5 级别（不可用）时返回 coming_soon 状态")
    void getById_level5_returnsComingSoon() {
        when(bridgeRepo.findById("bfs-to-gcn")).thenReturn(Optional.of(testBridge));

        PaperBridgeDTO dto = service.getById("bfs-to-gcn", 5);

        assertThat(dto.getStatus()).isEqualTo("coming_soon");
        assertThat(dto.getMessage()).isEqualTo("即将支持");
        assertThat(dto.getSelectedInterpretation()).isNull();
        assertThat(dto.getL5Available()).isFalse();
    }

    @Test
    @DisplayName("experimentType 字段正确传递到 DTO")
    void getById_experimentType_passedToDTO() {
        when(bridgeRepo.findById("bfs-to-gcn")).thenReturn(Optional.of(testBridge));

        PaperBridgeDTO dto = service.getById("bfs-to-gcn", 3);

        assertThat(dto.getExperimentType()).isEqualTo("COLAB");
        assertThat(dto.getExperimentUrl()).isEqualTo("https://colab.example.com/gcn");
    }

    @Test
    @DisplayName("所有级别都有真实内容时全部标为 available")
    void getById_allLevelsAvailable() {
        PaperBridge fullBridge = new PaperBridge()
                .setId("full-bridge")
                .setBaseAlgorithm("DP")
                .setPaperTitle("Full Paper")
                .setDomain(FrontierDomain.NLP)
                .setExperimentType("COLAB")
                .setLeveledInterpretation(Map.of(
                        3, "L3 真实内容",
                        4, "L4 详解版",
                        5, "L5 精读版"
                ));
        when(bridgeRepo.findById("full-bridge")).thenReturn(Optional.of(fullBridge));

        PaperBridgeDTO dto = service.getById("full-bridge", 4);

        assertThat(dto.getStatus()).isEqualTo("available");
        assertThat(dto.getL3Available()).isTrue();
        assertThat(dto.getL4Available()).isTrue();
        assertThat(dto.getL5Available()).isTrue();
        assertThat(dto.getSelectedInterpretation()).isEqualTo("L4 详解版");
    }
}

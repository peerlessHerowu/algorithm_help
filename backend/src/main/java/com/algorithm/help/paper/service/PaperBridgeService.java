package com.algorithm.help.paper.service;

import com.algorithm.help.common.exception.ResourceNotFoundException;
import com.algorithm.help.paper.dto.PaperBridgeDTO;
import com.algorithm.help.paper.entity.PaperBridge;
import com.algorithm.help.paper.enums.FrontierDomain;
import com.algorithm.help.paper.repository.PaperBridgeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 论文桥梁路径管理服务
 */
@Service
@RequiredArgsConstructor
public class PaperBridgeService {

    private final PaperBridgeRepository bridgeRepo;

    /**
     * 按前沿领域获取论文桥梁列表
     */
    public List<PaperBridge> getByDomain(FrontierDomain domain) {
        return bridgeRepo.findByDomain(domain);
    }

    /**
     * 根据 ID 获取论文桥梁详情
     */
    public PaperBridge getById(String id) {
        return bridgeRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PaperBridge", id));
    }

    /**
     * 根据 ID 获取论文桥梁详情，包含指定级别的解读。
     * 当请求的级别不可用时，返回 "coming_soon" 降级响应。
     */
    public PaperBridgeDTO getById(String id, Integer level) {
        PaperBridge bridge = getById(id);
        return toDTO(bridge, level);
    }

    /**
     * 将实体转换为 DTO，提取指定级别的解读内容，并计算可用性状态
     */
    private PaperBridgeDTO toDTO(PaperBridge bridge, Integer level) {
        Map<Integer, String> interpretations = bridge.getLeveledInterpretation();
        String interpretation = interpretations != null ? interpretations.get(level) : null;

        // 计算各级别可用性
        boolean l3 = isLevelAvailable(interpretations, 3);
        boolean l4 = isLevelAvailable(interpretations, 4);
        boolean l5 = isLevelAvailable(interpretations, 5);

        // 判断当前请求级别是否可用
        boolean currentAvailable = isLevelAvailable(interpretations, level);
        String status = currentAvailable ? "available" : "coming_soon";
        String message = currentAvailable ? null : "即将支持";

        return new PaperBridgeDTO()
                .setId(bridge.getId())
                .setBaseAlgorithm(bridge.getBaseAlgorithm())
                .setPaperTitle(bridge.getPaperTitle())
                .setPaperAuthors(bridge.getPaperAuthors())
                .setPaperYear(bridge.getPaperYear())
                .setPaperUrl(bridge.getPaperUrl())
                .setDomain(bridge.getDomain())
                .setBridgePath(bridge.getBridgePath())
                .setLeveledInterpretation(bridge.getLeveledInterpretation())
                .setExperimentType(bridge.getExperimentType())
                .setExperimentUrl(bridge.getExperimentUrl())
                .setCreatedAt(bridge.getCreatedAt())
                .setRequestedLevel(level)
                .setSelectedInterpretation(currentAvailable ? interpretation : null)
                .setStatus(status)
                .setMessage(message)
                .setL3Available(l3)
                .setL4Available(l4)
                .setL5Available(l5);
    }

    /**
     * 判断指定级别的解读是否真正可用（非空且不是占位文字）
     */
    private boolean isLevelAvailable(Map<Integer, String> interpretations, Integer level) {
        if (interpretations == null || level == null) {
            return false;
        }
        String content = interpretations.get(level);
        return content != null && !content.isBlank() && !"即将支持".equals(content);
    }
}

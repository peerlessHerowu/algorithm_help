package com.algorithm.help.config;

import com.algorithm.help.application.entity.ApplicationMapping;
import com.algorithm.help.application.entity.CrossDomainMapping;
import com.algorithm.help.application.repository.ApplicationMappingRepository;
import com.algorithm.help.application.repository.CrossDomainMappingRepository;
import com.algorithm.help.application.service.ApplicationMappingService;
import com.algorithm.help.archaeology.entity.AlgorithmArchaeology;
import com.algorithm.help.archaeology.repository.AlgorithmArchaeologyRepository;
import com.algorithm.help.graph.entity.GraphEdge;
import com.algorithm.help.graph.entity.GraphNode;
import com.algorithm.help.graph.entity.LearningPath;
import com.algorithm.help.graph.repository.GraphEdgeRepository;
import com.algorithm.help.graph.repository.GraphNodeRepository;
import com.algorithm.help.graph.repository.LearningPathRepository;
import com.algorithm.help.paper.entity.PaperBridge;
import com.algorithm.help.paper.repository.PaperBridgeRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.List;

/**
 * 图谱种子数据加载器
 * <p>
 * 启动时幂等加载种子数据，按顺序：graph-nodes → graph-edges → learning-paths → archaeology → paper-bridges
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GraphSeedDataLoader implements ApplicationRunner {

    private final GraphNodeRepository nodeRepo;
    private final GraphEdgeRepository edgeRepo;
    private final LearningPathRepository pathRepo;
    private final AlgorithmArchaeologyRepository archaeologyRepo;
    private final PaperBridgeRepository paperBridgeRepo;
    private final CrossDomainMappingRepository crossDomainRepo;
    private final ApplicationMappingRepository appMappingRepo;
    private final ApplicationMappingService appMappingService;
    private final ObjectMapper objectMapper;

    @Override
    public void run(ApplicationArguments args) {
        loadGraphNodes();
        loadGraphEdges();
        loadLearningPaths();
        loadArchaeology();
        loadPaperBridges();
        loadCrossDomainMappings();
        loadApplicationMappings();
    }

    /** 加载图谱节点种子数据 */
    private void loadGraphNodes() {
        if (nodeRepo.count() > 0) {
            log.info("[种子数据] graph-nodes 已存在，跳过加载");
            return;
        }
        List<GraphNode> nodes = loadJson("data/seed/graph-nodes.json", new TypeReference<>() {});
        if (nodes != null && !nodes.isEmpty()) {
            nodeRepo.saveAll(nodes);
            log.info("[种子数据] 成功加载 {} 个图谱节点", nodes.size());
        }
    }

    /** 加载图谱边种子数据 */
    private void loadGraphEdges() {
        if (edgeRepo.count() > 0) {
            log.info("[种子数据] graph-edges 已存在，跳过加载");
            return;
        }
        List<GraphEdge> edges = loadJson("data/seed/graph-edges.json", new TypeReference<>() {});
        if (edges != null && !edges.isEmpty()) {
            edgeRepo.saveAll(edges);
            log.info("[种子数据] 成功加载 {} 条图谱边", edges.size());
        }
    }

    /** 加载学习路径种子数据 */
    private void loadLearningPaths() {
        if (pathRepo.count() > 0) {
            log.info("[种子数据] learning-paths 已存在，跳过加载");
            return;
        }
        List<LearningPath> paths = loadJson("data/seed/learning-paths.json", new TypeReference<>() {});
        if (paths != null && !paths.isEmpty()) {
            pathRepo.saveAll(paths);
            log.info("[种子数据] 成功加载 {} 条学习路径", paths.size());
        }
    }

    /** 加载算法考古种子数据 */
    private void loadArchaeology() {
        if (archaeologyRepo.count() > 0) {
            log.info("[种子数据] archaeology 已存在，跳过加载");
            return;
        }
        List<AlgorithmArchaeology> items = loadJson(
                "data/seed/archaeology.json", new TypeReference<>() {});
        if (items != null && !items.isEmpty()) {
            archaeologyRepo.saveAll(items);
            log.info("[种子数据] 成功加载 {} 条算法考古数据", items.size());
        }
    }

    /** 加载论文桥梁种子数据 */
    private void loadPaperBridges() {
        if (paperBridgeRepo.count() > 0) {
            log.info("[种子数据] paper-bridges 已存在，跳过加载");
            return;
        }
        List<PaperBridge> bridges = loadJson(
                "data/seed/paper-bridges.json", new TypeReference<>() {});
        if (bridges != null && !bridges.isEmpty()) {
            paperBridgeRepo.saveAll(bridges);
            log.info("[种子数据] 成功加载 {} 条论文桥梁数据", bridges.size());
        }
    }

    /** 加载跨域迁移映射种子数据 */
    private void loadCrossDomainMappings() {
        if (crossDomainRepo.count() > 0) {
            log.info("[种子数据] cross-domain-mappings 已存在，跳过加载");
            return;
        }
        List<CrossDomainMapping> mappings = loadJson(
                "data/seed/cross-domain-mappings.json", new TypeReference<>() {});
        if (mappings != null && !mappings.isEmpty()) {
            crossDomainRepo.saveAll(mappings);
            log.info("[种子数据] 成功加载 {} 条跨域映射数据", mappings.size());
        }
    }

    /** 加载应用映射种子数据（含迷你案例代码行数校验） */
    private void loadApplicationMappings() {
        if (appMappingRepo.count() > 0) {
            log.info("[种子数据] application-mappings 已存在，跳过加载");
            return;
        }
        List<ApplicationMapping> mappings = loadJson(
                "data/seed/application-mappings.json", new TypeReference<>() {});
        if (mappings == null || mappings.isEmpty()) {
            return;
        }
        // 导入时校验迷你案例代码行数
        for (ApplicationMapping mapping : mappings) {
            appMappingService.validateMiniCaseCode(mapping);
        }
        appMappingRepo.saveAll(mappings);
        log.info("[种子数据] 成功加载 {} 条应用映射数据", mappings.size());
    }

    /**
     * 从 classpath 加载 JSON 文件并反序列化
     */
    private <T> T loadJson(String path, TypeReference<T> typeRef) {
        try {
            ClassPathResource resource = new ClassPathResource(path);
            if (!resource.exists()) {
                log.warn("[种子数据] 文件不存在: {}", path);
                return null;
            }
            try (InputStream is = resource.getInputStream()) {
                return objectMapper.readValue(is, typeRef);
            }
        } catch (Exception e) {
            log.error("[种子数据] 加载失败: {}, 原因: {}", path, e.getMessage());
            return null;
        }
    }
}

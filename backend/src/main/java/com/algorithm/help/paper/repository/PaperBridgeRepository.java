package com.algorithm.help.paper.repository;

import com.algorithm.help.paper.entity.PaperBridge;
import com.algorithm.help.paper.enums.FrontierDomain;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 论文桥梁数据访问层
 */
public interface PaperBridgeRepository extends JpaRepository<PaperBridge, String> {

    /**
     * 根据前沿领域查询论文桥梁
     */
    List<PaperBridge> findByDomain(FrontierDomain domain);

    /**
     * 根据基础算法名称查询论文桥梁
     */
    List<PaperBridge> findByBaseAlgorithm(String baseAlgorithm);
}

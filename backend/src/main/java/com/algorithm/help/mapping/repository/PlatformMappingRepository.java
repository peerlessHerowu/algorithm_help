package com.algorithm.help.mapping.repository;

import com.algorithm.help.mapping.entity.PlatformMapping;
import com.algorithm.help.mapping.enums.MappingStatus;
import com.algorithm.help.mapping.enums.Platform;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * 多平台映射数据访问层
 */
public interface PlatformMappingRepository extends JpaRepository<PlatformMapping, String> {

    /**
     * 根据平台和平台 ID 查找映射（唯一）
     */
    Optional<PlatformMapping> findByPlatformAndPlatformId(Platform platform, String platformId);

    /**
     * 查询某题在所有平台的映射
     */
    List<PlatformMapping> findByUnifiedProblemId(String unifiedProblemId);

    /**
     * 按映射状态查询（如获取所有待确认映射）
     */
    List<PlatformMapping> findByStatus(MappingStatus status);

    /**
     * 按映射状态分页查询
     */
    Page<PlatformMapping> findByStatus(MappingStatus status, Pageable pageable);

    /**
     * 按平台分页查询
     */
    Page<PlatformMapping> findByPlatform(Platform platform, Pageable pageable);

    /**
     * 按平台和状态分页查询
     */
    Page<PlatformMapping> findByPlatformAndStatus(Platform platform, MappingStatus status, Pageable pageable);
}

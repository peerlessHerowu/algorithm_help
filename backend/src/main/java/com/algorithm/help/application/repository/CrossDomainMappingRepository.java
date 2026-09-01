package com.algorithm.help.application.repository;

import com.algorithm.help.application.entity.CrossDomainMapping;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * 跨域映射数据访问层
 */
public interface CrossDomainMappingRepository extends JpaRepository<CrossDomainMapping, String> {

    Optional<CrossDomainMapping> findByPatternId(String patternId);
}

package com.algorithm.help.application.repository;

import com.algorithm.help.application.entity.ApplicationMapping;
import com.algorithm.help.application.enums.ApplicationDomain;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 应用映射数据访问层
 */
public interface ApplicationMappingRepository extends JpaRepository<ApplicationMapping, String> {

    List<ApplicationMapping> findByPatternId(String patternId);

    List<ApplicationMapping> findByPatternIdAndDomain(String patternId, ApplicationDomain domain);
}

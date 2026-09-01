package com.algorithm.help.interactive.interview;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * 面试报告 Repository
 */
public interface InterviewReportRepository extends JpaRepository<InterviewReport, String> {

    Optional<InterviewReport> findBySessionId(String sessionId);

    List<InterviewReport> findByUserIdOrderByCreatedAtDesc(String userId);
}

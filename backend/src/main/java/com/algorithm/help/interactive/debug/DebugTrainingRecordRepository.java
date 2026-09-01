package com.algorithm.help.interactive.debug;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Debug 训练记录 Repository
 */
public interface DebugTrainingRecordRepository extends JpaRepository<DebugTrainingRecord, String> {

    List<DebugTrainingRecord> findByUserIdOrderByCreatedAtDesc(String userId);

    List<DebugTrainingRecord> findByUserIdAndBugType(String userId, String bugType);
}

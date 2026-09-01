package com.algorithm.help.training.repository;

import com.algorithm.help.training.entity.TrainingRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 训练记录数据访问层
 */
public interface TrainingRecordRepository extends JpaRepository<TrainingRecord, String> {

    /** 查询某用户的全部训练记录 */
    List<TrainingRecord> findByUserId(String userId);

    /** 查询某用户某题的训练记录 */
    List<TrainingRecord> findByUserIdAndProblemId(String userId, String problemId);
}

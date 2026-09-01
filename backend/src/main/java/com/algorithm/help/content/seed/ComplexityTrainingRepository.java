package com.algorithm.help.content.seed;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 复杂度训练题 Repository
 */
@Repository
public interface ComplexityTrainingRepository extends JpaRepository<ComplexityTrainingProblem, String> {

    /**
     * 按模式查询训练题
     */
    List<ComplexityTrainingProblem> findByMode(String mode);

    /**
     * 按难度查询训练题
     */
    List<ComplexityTrainingProblem> findByDifficulty(String difficulty);

    /**
     * 按模式和难度查询训练题
     */
    List<ComplexityTrainingProblem> findByModeAndDifficulty(String mode, String difficulty);
}

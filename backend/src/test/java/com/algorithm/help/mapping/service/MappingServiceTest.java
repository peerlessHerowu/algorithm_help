package com.algorithm.help.mapping.service;

import com.algorithm.help.mapping.dto.CsvImportResult;
import com.algorithm.help.mapping.dto.PlatformLinkDTO;
import com.algorithm.help.mapping.entity.PlatformMapping;
import com.algorithm.help.mapping.enums.MappingStatus;
import com.algorithm.help.mapping.enums.Platform;
import com.algorithm.help.mapping.repository.PlatformMappingRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * MappingService 单元测试
 */
@ExtendWith(MockitoExtension.class)
class MappingServiceTest {

    @Mock
    private PlatformMappingRepository mappingRepo;

    @InjectMocks
    private MappingService mappingService;

    // ==================== resolve 方法测试 ====================

    @Test
    void resolve_存在映射时返回统一ID() {
        PlatformMapping mapping = new PlatformMapping()
                .setPlatform(Platform.LEETCODE)
                .setPlatformId("1")
                .setUnifiedProblemId("unified-001");
        when(mappingRepo.findByPlatformAndPlatformId(Platform.LEETCODE, "1"))
                .thenReturn(Optional.of(mapping));

        Optional<String> result = mappingService.resolve(Platform.LEETCODE, "1");

        assertThat(result).isPresent().contains("unified-001");
    }

    @Test
    void resolve_不存在映射时返回空() {
        when(mappingRepo.findByPlatformAndPlatformId(Platform.CODEFORCES, "999"))
                .thenReturn(Optional.empty());

        Optional<String> result = mappingService.resolve(Platform.CODEFORCES, "999");

        assertThat(result).isEmpty();
    }

    // ==================== importFromCsv 方法测试 ====================

    @Test
    void importFromCsv_正常导入() {
        String csv = "platform,platformId,platformUrl,unifiedProblemId\n"
                + "LEETCODE,1,https://leetcode.com/problems/two-sum,unified-001\n"
                + "NOWCODER,NC001,https://nowcoder.com/practice/nc001,unified-001\n";
        MockMultipartFile file = new MockMultipartFile(
                "file", "mapping.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        when(mappingRepo.findByPlatformAndPlatformId(any(), any())).thenReturn(Optional.empty());
        when(mappingRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CsvImportResult result = mappingService.importFromCsv(file);

        assertThat(result.getTotalRows()).isEqualTo(2);
        assertThat(result.getSuccessCount()).isEqualTo(2);
        assertThat(result.getErrorCount()).isEqualTo(0);
        verify(mappingRepo, times(2)).save(any(PlatformMapping.class));
    }

    @Test
    void importFromCsv_跳过无效平台行() {
        String csv = "platform,platformId,platformUrl,unifiedProblemId\n"
                + "INVALID_PLATFORM,1,http://x.com,unified-001\n"
                + "LEETCODE,2,http://lc.com/2,unified-002\n";
        MockMultipartFile file = new MockMultipartFile(
                "file", "mapping.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        when(mappingRepo.findByPlatformAndPlatformId(any(), any())).thenReturn(Optional.empty());
        when(mappingRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CsvImportResult result = mappingService.importFromCsv(file);

        assertThat(result.getTotalRows()).isEqualTo(2);
        assertThat(result.getSuccessCount()).isEqualTo(1);
        assertThat(result.getErrorCount()).isEqualTo(1);
        assertThat(result.getErrors().get(0)).contains("无效平台");
    }

    @Test
    void importFromCsv_跳过列数不足行() {
        String csv = "platform,platformId,platformUrl,unifiedProblemId\n"
                + "LEETCODE,1\n"
                + "LEETCODE,3,http://lc.com/3,unified-003\n";
        MockMultipartFile file = new MockMultipartFile(
                "file", "mapping.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        when(mappingRepo.findByPlatformAndPlatformId(any(), any())).thenReturn(Optional.empty());
        when(mappingRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CsvImportResult result = mappingService.importFromCsv(file);

        assertThat(result.getSuccessCount()).isEqualTo(1);
        assertThat(result.getErrorCount()).isEqualTo(1);
        assertThat(result.getErrors().get(0)).contains("列数不足");
    }

    @Test
    void importFromCsv_跳过必填字段为空行() {
        String csv = "platform,platformId,platformUrl,unifiedProblemId\n"
                + "LEETCODE,,http://lc.com/x,unified-004\n";
        MockMultipartFile file = new MockMultipartFile(
                "file", "mapping.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        CsvImportResult result = mappingService.importFromCsv(file);

        assertThat(result.getSuccessCount()).isEqualTo(0);
        assertThat(result.getErrorCount()).isEqualTo(1);
        assertThat(result.getErrors().get(0)).contains("platformId 或 unifiedProblemId 为空");
    }

    @Test
    void importFromCsv_空文件返回空报告() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "empty.csv", "text/csv", "".getBytes(StandardCharsets.UTF_8));

        CsvImportResult result = mappingService.importFromCsv(file);

        assertThat(result.getTotalRows()).isEqualTo(0);
        assertThat(result.getSuccessCount()).isEqualTo(0);
    }

    @Test
    void importFromCsv_已存在映射则更新() {
        String csv = "platform,platformId,platformUrl,unifiedProblemId\n"
                + "LEETCODE,1,https://new-url.com,unified-new\n";
        MockMultipartFile file = new MockMultipartFile(
                "file", "mapping.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        PlatformMapping existing = new PlatformMapping()
                .setPlatform(Platform.LEETCODE)
                .setPlatformId("1")
                .setPlatformUrl("https://old-url.com")
                .setUnifiedProblemId("unified-old")
                .setStatus(MappingStatus.PENDING);
        when(mappingRepo.findByPlatformAndPlatformId(Platform.LEETCODE, "1"))
                .thenReturn(Optional.of(existing));
        when(mappingRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CsvImportResult result = mappingService.importFromCsv(file);

        assertThat(result.getSuccessCount()).isEqualTo(1);
        ArgumentCaptor<PlatformMapping> captor = ArgumentCaptor.forClass(PlatformMapping.class);
        verify(mappingRepo).save(captor.capture());
        PlatformMapping saved = captor.getValue();
        assertThat(saved.getUnifiedProblemId()).isEqualTo("unified-new");
        assertThat(saved.getPlatformUrl()).isEqualTo("https://new-url.com");
        assertThat(saved.getStatus()).isEqualTo(MappingStatus.CONFIRMED);
    }

    // ==================== getLinks 方法测试 ====================

    @Test
    void getLinks_返回所有平台链接() {
        List<PlatformMapping> mappings = List.of(
                new PlatformMapping()
                        .setPlatform(Platform.LEETCODE).setPlatformId("1")
                        .setPlatformUrl("https://leetcode.com/problems/two-sum")
                        .setPlatformTitle("Two Sum"),
                new PlatformMapping()
                        .setPlatform(Platform.NOWCODER).setPlatformId("NC001")
                        .setPlatformUrl("https://nowcoder.com/nc001")
                        .setPlatformTitle("两数之和")
        );
        when(mappingRepo.findByUnifiedProblemId("unified-001")).thenReturn(mappings);

        List<PlatformLinkDTO> result = mappingService.getLinks("unified-001");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getPlatform()).isEqualTo(Platform.LEETCODE);
        assertThat(result.get(1).getPlatform()).isEqualTo(Platform.NOWCODER);
    }

    @Test
    void getLinks_无映射返回空列表() {
        when(mappingRepo.findByUnifiedProblemId("nonexistent")).thenReturn(List.of());

        List<PlatformLinkDTO> result = mappingService.getLinks("nonexistent");

        assertThat(result).isEmpty();
    }

    // ==================== fuzzyMatch 方法测试 ====================

    @Test
    void fuzzyMatch_高相似度标记为CONFIRMED() {
        PlatformMapping mapping = new PlatformMapping()
                .setPlatform(Platform.LEETCODE).setPlatformId("1")
                .setPlatformTitle("Two Sum")
                .setStatus(MappingStatus.PENDING);
        when(mappingRepo.findAll()).thenReturn(List.of(mapping));
        when(mappingRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // 完全相同的标题 → Jaccard = 1.0 > 0.85
        Optional<PlatformMapping> result = mappingService.fuzzyMatch("Two Sum");

        assertThat(result).isPresent();
        assertThat(result.get().getStatus()).isEqualTo(MappingStatus.CONFIRMED);
    }

    @Test
    void fuzzyMatch_低相似度标记为PENDING() {
        PlatformMapping mapping = new PlatformMapping()
                .setPlatform(Platform.LEETCODE).setPlatformId("1")
                .setPlatformTitle("Two Sum Target")
                .setStatus(MappingStatus.CONFIRMED);
        when(mappingRepo.findAll()).thenReturn(List.of(mapping));
        when(mappingRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // 仅部分重叠："Two" 匹配，但 Jaccard = 1/5 = 0.2 < 0.85
        Optional<PlatformMapping> result = mappingService.fuzzyMatch("Two Pointer Sliding Window");

        assertThat(result).isPresent();
        assertThat(result.get().getStatus()).isEqualTo(MappingStatus.PENDING);
    }

    @Test
    void fuzzyMatch_空标题返回空() {
        Optional<PlatformMapping> result = mappingService.fuzzyMatch("");
        assertThat(result).isEmpty();

        result = mappingService.fuzzyMatch(null);
        assertThat(result).isEmpty();
    }

    @Test
    void fuzzyMatch_无候选映射返回空() {
        when(mappingRepo.findAll()).thenReturn(List.of());

        Optional<PlatformMapping> result = mappingService.fuzzyMatch("Some Title");

        assertThat(result).isEmpty();
    }
}

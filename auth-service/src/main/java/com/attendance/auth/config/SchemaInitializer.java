package com.attendance.auth.config;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Order(0)
public class SchemaInitializer implements ApplicationRunner {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            Number existing = (Number) entityManager
                    .createNativeQuery(
                            "SELECT COUNT(*) FROM information_schema.columns " +
                                    "WHERE table_schema = DATABASE() " +
                                    "AND table_name = 'staffs' " +
                                    "AND column_name = 'has_face'"
                    )
                    .getSingleResult();
            if (existing.intValue() == 0) {
                entityManager
                        .createNativeQuery("ALTER TABLE staffs ADD COLUMN has_face BOOLEAN NOT NULL DEFAULT FALSE")
                        .executeUpdate();
            }
            entityManager
                    .createNativeQuery("UPDATE staffs SET has_face = FALSE WHERE has_face IS NULL")
                    .executeUpdate();
            log.info("[SchemaInitializer] ensured column staffs.has_face exists with default FALSE");
        } catch (Exception exc) {
            throw new IllegalStateException("Failed to initialize auth-service schema changes", exc);
        }
    }
}

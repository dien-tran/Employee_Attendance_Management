package com.attendance.core.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class InternalAttendanceSyncException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public InternalAttendanceSyncException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

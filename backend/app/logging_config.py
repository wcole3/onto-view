"""Logging configuration for the ontology viewer backend."""

import logging.config

# Libraries that log at excessive volume during normal operation.
_NOISY_LIBRARIES = ("rdflib", "httpx", "urllib3", "linkml_runtime")


def configure_logging(level: str, environment: str) -> None:
    """Configure root logging for the application.

    Development uses human-readable lines; production uses compact JSON-like
    lines. Source file contents and authorization material are never logged.
    """
    if environment == "development":
        log_format = "%(asctime)s %(levelname)-8s %(name)s - %(message)s"
    else:
        log_format = (
            '{"time": "%(asctime)s", "level": "%(levelname)s", '
            '"logger": "%(name)s", "message": "%(message)s"}'
        )

    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {"default": {"format": log_format}},
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                    "stream": "ext://sys.stdout",
                }
            },
            "root": {"level": level.upper(), "handlers": ["console"]},
            "loggers": {name: {"level": "WARNING"} for name in _NOISY_LIBRARIES},
        }
    )

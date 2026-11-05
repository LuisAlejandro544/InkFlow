# CMakeLists.txt - Módulo Central C++23 para InkFlow Studio
# Estándar C++23 (ISO/IEC 14882:2023)

cmake_minimum_required(VERSION 3.25)
project(inkflow_cpp_core LANGUAGES CXX VERSION 1.0.0)

# Configurar estrictamente la versión C++23
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Opciones de optimización y arquitecturas
if(MSVC)
    add_compile_options(/W4 /O2 /permissive-)
else()
    add_compile_options(
        -Wall
        -Wextra
        -Wpedantic
        -O3
        -fno-exceptions
        -fno-rtti
    )
endif()

# Archivos de cabecera e implementación
set(SOURCES
    src/IbisStrokeAnalyzer.cpp
    src/IbisVectorEngine.cpp
)

set(HEADERS
    include/IbisStrokeAnalyzer.hpp
    include/IbisVectorEngine.hpp
)

# 1. Biblioteca estática nativa (para pruebas nativas y NDK Android)
add_library(inkflow_cpp_core STATIC ${SOURCES} ${HEADERS})
target_include_directories(inkflow_cpp_core PUBLIC include)

# 2. Configuración específica para WebAssembly con Emscripten (si está activo el compilador em++)
if(EMSCRIPTEN)
    message(STATUS "Configurando compilación C++23 hacia WebAssembly (wasm32)...")
    add_executable(inkflow_stroke_analyzer_wasm ${SOURCES})
    target_include_directories(inkflow_stroke_analyzer_wasm PRIVATE include)
    
    set_target_properties(inkflow_stroke_analyzer_wasm PROPERTIES SUFFIX ".js")
    target_link_options(inkflow_stroke_analyzer_wasm PRIVATE
        "-sWASM=1"
        "-sMODULARIZE=1"
        "-sEXPORT_NAME=createInkflowCppModule"
        "-sEXPORTED_FUNCTIONS=['_ibis_analyze_stroke_role','_ibis_sample_point_thickness','_ibis_close_boundary_gaps','_ibis_apply_sobel_lineart','_ibis_vector_simplify_points','_ibis_vector_generate_bezier_segments','_ibis_vector_evaluate_bezier','_malloc','_free']"
        "-sEXPORTED_RUNTIME_METHODS=['ccall','cwrap','HEAPU8','HEAPF32']"
        "-sALLOW_MEMORY_GROWTH=1"
        "-sNO_FILESYSTEM=1"
        "-O3"
        "-msimd128"
    )
endif()

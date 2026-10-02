cmake_minimum_required(VERSION 3.16)
project(glop_runtime LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
add_executable(glop-runtime glop-runtime.cpp)
add_executable(glop glop.cpp)\n
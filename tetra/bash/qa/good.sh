#!/bin/bash
source $HOME/src/mricos/bash/qa/qa.sh

#C: C is for context. remove C and Q, replace A: with code.
#restate entire code file
#Q: i want to prepend '$@' to stdin before calling qa_query
#which uses '$(cat)' for its input
#A:
qa_query
a

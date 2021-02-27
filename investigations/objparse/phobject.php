<?php 
final class Type
{
    const Link     = "LINK";
    const Logmsg   = "LOGMSG";
    const Text     = "TEXT";
    private function __construct(){}  //prevents class from being instantianted
}

class  PhObject
{
    public $type;
    public $text;
    public $timestamp;

    function __construct(){
        $this->type = Type::Text;
        $this->text = "default ph-object text";
        $this->timestamp = microtime(true); // true = return as float
    }
}

?>
